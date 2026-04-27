import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import type { AppError } from "@/common/errors/base";
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
    const blockchainTxRepo = new BlockchainTransactionRepository(this.db);

    const tokenAmountWei = calculateTokenAmountWei(input.amountCents);

    return userRepo
      .findById(senderUserId)
      .andThen((sender) => {
        if (!sender || sender.kycStatusId !== KYC_STATUS.VERIFIED) {
          return errAsync(new TransferKycRequiredError());
        }
        return okAsync(sender);
      })
      .andThen((sender) =>
        walletRepo.findPrimaryByUserId(senderUserId).andThen((senderWallet) => {
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
            return errAsync(new RecipientNotFoundError(input.recipientEmail));
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
                .updateStatus(transfer.id, TRANSACTION_STATUS.FAILED)
                .orElse((dbErr) => {
                  logger.error(
                    { error: dbErr.toLog() },
                    "Failed to mark transfer as FAILED after on-chain error"
                  );
                  return okAsync(undefined);
                })
                .andThen(() => {
                  logger.error(
                    {
                      error: transferError.toLog(),
                      transferId: transfer.id.toString(),
                    },
                    "On-chain token transfer failed — transfer marked FAILED"
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
      .andThen(({ senderWallet, receiver, receiverWallet, transfer, txHash }) =>
        blockchainTxRepo
          .create({
            networkId: senderWallet.networkId,
            transactionTypeId: TRANSACTION_TYPE.TRANSFER,
            fromAddress: senderWallet.address,
            toAddress: receiverWallet.address,
            txHash,
            amount: tokenAmountWei,
            isConfirmed: true,
            confirmations: 1,
          })
          .map((blockchainTx) => ({
            receiver,
            transfer,
            blockchainTx,
          }))
      )
      .andThen(({ receiver, transfer, blockchainTx }) =>
        transferRepo.complete(transfer.id, blockchainTx.id).map(() => ({
          transferId: transfer.publicId,
          recipientName: receiver.name,
          status: "completed" as const,
        }))
      )
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
