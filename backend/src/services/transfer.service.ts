import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { AppError } from "@/common/errors/base";
import { InternalError } from "@/common/errors/infrastructure";
import {
  RecipientNotFoundError,
  SelfTransferError,
  TransferKycRequiredError,
} from "@/common/errors/transfer";
import {
  InsufficientBalanceError,
  WalletNotFoundError,
} from "@/common/errors/wallet";
import { WalletNotCustodialError } from "@/common/errors/withdrawal";
import { KYC_STATUS } from "../constants/kyc-status";
import { TRANSACTION_STATUS } from "../constants/transaction-status";
import { TRANSACTION_TYPE } from "../constants/transaction-type";
import type { Database } from "../db";
import type { InitiateTransferRequest } from "../dto/transfer.dto";
import { sendTransferReceivedEmail, sendTransferSentEmail } from "../lib/email";
import { logger } from "../lib/logger";
import { BlockchainTransactionRepository } from "../repositories/blockchain-transaction.repository";
import { TransferRepository } from "../repositories/transfer.repository";
import { UserRepository } from "../repositories/user.repository";
import { WalletRepository } from "../repositories/wallet.repository";
import { getOnChainBalance, transferTokens } from "./blockchain";
import { calculateTokenAmountWei } from "./stripe.service";

export class TransferService {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  initiateTransfer(
    senderUserId: bigint,
    input: InitiateTransferRequest
  ): ResultAsync<
    { transferId: string; recipientName: string; status: "completed" },
    AppError
  > {
    const userRepo = new UserRepository(this.db);
    const walletRepo = new WalletRepository(this.db);
    const transferRepo = new TransferRepository(this.db);

    const tokenAmountWei = calculateTokenAmountWei(input.amountCents);

    return (
      input.idempotencyKey
        ? transferRepo.findByIdempotencyKey(senderUserId, input.idempotencyKey)
        : okAsync(null)
    )
      .andThen((existing) => {
        if (!existing) {
          return okAsync(null);
        }
        if (existing.statusId === TRANSACTION_STATUS.COMPLETED) {
          logger.info(
            { idempotencyKey: input.idempotencyKey },
            "Duplicate transfer request — returning existing completed transfer"
          );
          return userRepo
            .findById(existing.receiverUserId)
            .andThen((receiver) =>
              okAsync({
                transferId: existing.publicId,
                recipientName: receiver?.name ?? "Unknown",
                status: "completed" as const,
              })
            );
        }
        return okAsync(null);
      })
      .andThen((shortCircuit) => {
        if (shortCircuit) {
          return okAsync(shortCircuit);
        }
        return userRepo
          .findById(senderUserId)
          .andThen((sender) => {
            if (!sender || sender.kycStatusId !== KYC_STATUS.VERIFIED) {
              return errAsync(new TransferKycRequiredError());
            }
            return okAsync(sender);
          })
          .andThen((sender) =>
            walletRepo
              .findPrimaryByUserId(senderUserId)
              .andThen((senderWallet) => {
                if (!senderWallet) {
                  return errAsync(new WalletNotFoundError("primary"));
                }
                if (
                  senderWallet.walletType !== "CUSTODIAL" ||
                  !senderWallet.encryptedPrivateKey
                ) {
                  return errAsync(
                    new WalletNotCustodialError(senderWallet.id.toString())
                  );
                }
                return okAsync({ sender, senderWallet });
              })
          )
          .andThen(({ sender, senderWallet }) =>
            userRepo.findByEmail(input.recipientEmail).andThen((receiver) => {
              if (!receiver) {
                return errAsync(
                  new RecipientNotFoundError(input.recipientEmail)
                );
              }
              if (receiver.id === senderUserId) {
                return errAsync(new SelfTransferError());
              }
              return okAsync({ sender, senderWallet, receiver });
            })
          )
          .andThen(({ sender, senderWallet, receiver }) =>
            walletRepo
              .findPrimaryByUserId(receiver.id)
              .andThen((receiverWallet) => {
                if (!receiverWallet) {
                  return errAsync(
                    new WalletNotFoundError("receiver primary wallet")
                  );
                }
                return okAsync({
                  sender,
                  senderWallet,
                  receiver,
                  receiverWallet,
                });
              })
          )
          .andThen(({ sender, senderWallet, receiver, receiverWallet }) =>
            getOnChainBalance(senderWallet.address).andThen((balanceWei) => {
              if (BigInt(balanceWei) < BigInt(tokenAmountWei)) {
                return errAsync(
                  new InsufficientBalanceError(
                    BigInt(tokenAmountWei),
                    BigInt(balanceWei),
                    "ONE",
                    {
                      context: {
                        requiredWei: tokenAmountWei,
                        availableWei: balanceWei,
                      },
                    }
                  )
                );
              }
              return okAsync({
                sender,
                senderWallet,
                receiver,
                receiverWallet,
              });
            })
          )
          .andThen(({ sender, senderWallet, receiver, receiverWallet }) =>
            transferRepo
              .create({
                senderUserId,
                receiverUserId: receiver.id,
                senderWalletId: senderWallet.id,
                receiverWalletId: receiverWallet.id,
                statusId: TRANSACTION_STATUS.PENDING,
                amountCents: BigInt(input.amountCents),
                tokenAmount: tokenAmountWei,
                note: input.note ?? null,
              })
              .map((transfer) => ({
                sender,
                senderWallet,
                receiver,
                receiverWallet,
                transfer,
              }))
          )
          .andThen(
            ({ sender, senderWallet, receiver, receiverWallet, transfer }) => {
              const privateKey = senderWallet.encryptedPrivateKey;
              if (!privateKey) {
                return errAsync(
                  new WalletNotCustodialError(senderWallet.id.toString())
                );
              }
              return transferTokens(
                privateKey,
                receiverWallet.address,
                tokenAmountWei
              )
                .orElse((transferError) =>
                  transferRepo
                    .updateStatus(transfer.id, TRANSACTION_STATUS.PENDING)
                    .orElse((dbErr) => {
                      logger.error(
                        { error: dbErr.toLog() },
                        "Failed to mark transfer as PENDING after on-chain error"
                      );
                      return okAsync(undefined);
                    })
                    .andThen(() => {
                      logger.error(
                        {
                          error: transferError.toLog(),
                          transferId: transfer.id.toString(),
                        },
                        "On-chain token transfer error — transfer marked PENDING for reconciliation"
                      );
                      return errAsync(transferError);
                    })
                )
                .map((txHash) => ({
                  sender,
                  senderWallet,
                  receiver,
                  receiverWallet,
                  transfer,
                  txHash,
                }));
            }
          )
          .andThen(
            ({
              sender,
              senderWallet,
              receiver,
              receiverWallet,
              transfer,
              txHash,
            }) =>
              ResultAsync.fromPromise(
                this.db.transaction(async (tx) => {
                  // sender and receiver are captured in closure for the notification below
                  const txBlockchainRepo = new BlockchainTransactionRepository(
                    tx as unknown as Database
                  );
                  const txTransferRepo = new TransferRepository(
                    tx as unknown as Database
                  );

                  const blockchainTxResult = await txBlockchainRepo.create({
                    networkId: senderWallet.networkId,
                    transactionTypeId: TRANSACTION_TYPE.TRANSFER,
                    fromAddress: senderWallet.address,
                    toAddress: receiverWallet.address,
                    txHash,
                    amount: tokenAmountWei,
                    isConfirmed: true,
                    confirmations: 1,
                  });

                  if (blockchainTxResult.isErr()) {
                    throw blockchainTxResult.error;
                  }

                  const completeResult = await txTransferRepo.complete(
                    transfer.id,
                    blockchainTxResult.value.id
                  );

                  if (completeResult.isErr()) {
                    throw completeResult.error;
                  }

                  return {
                    sender,
                    receiver,
                    transferId: transfer.publicId,
                    recipientName: receiver.name,
                    status: "completed" as const,
                  };
                }),
                (e): AppError => {
                  if (e instanceof AppError) {
                    return e;
                  }
                  return new InternalError(
                    "Failed to persist transfer completion — manual reconciliation required",
                    {
                      cause: e,
                      context: {
                        transferId: transfer.id.toString(),
                        txHash,
                      },
                    }
                  );
                }
              )
          )
          .andThen(
            ({ sender, receiver, transferId, recipientName, status }) => {
              // Non-blocking: email failures must not abort a completed transfer
              sendTransferSentEmail(
                sender.email,
                sender.name,
                recipientName,
                input.amountCents,
                transferId
              );
              sendTransferReceivedEmail(
                receiver.email,
                recipientName,
                sender.name,
                input.amountCents,
                transferId
              );
              return okAsync({ transferId, recipientName, status });
            }
          );
      })
      .mapErr((err) => {
        logger.error({ error: err.toLog() }, "P2P transfer failed");
        return err;
      });
  }

  getHistory(
    userId: bigint
  ): ResultAsync<
    import("../repositories/transfer.repository").TransferHistoryItem[],
    AppError
  > {
    const transferRepo = new TransferRepository(this.db);
    return transferRepo.findByUserId(userId);
  }
}
