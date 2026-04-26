import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type { AppError } from "@/common/errors/base";
import { ExternalServiceError } from "@/common/errors/infrastructure";
import { InsufficientBalanceError, WalletNotFoundError } from "@/common/errors/wallet";
import {
  WalletNotCustodialError,
  WithdrawalKycRequiredError,
} from "@/common/errors/withdrawal";
import { ZERO_ADDRESS } from "../constants/blockchain";
import { KYC_STATUS } from "../constants/kyc-status";
import { TRANSACTION_STATUS } from "../constants/transaction-status";
import { TRANSACTION_TYPE } from "../constants/transaction-type";
import type { Database } from "../db";
import { logger } from "../lib/logger";
import { BlockchainTransactionRepository } from "../repositories/blockchain-transaction.repository";
import { UserRepository } from "../repositories/user.repository";
import { WalletRepository } from "../repositories/wallet.repository";
import { WithdrawalRepository } from "../repositories/withdrawal.repository";
import type { InitiateWithdrawalRequest } from "../dto/withdrawal.dto";
import { burnTokens, getOnChainBalance } from "./blockchain";
import {
  addBankAccount,
  calculateTokenAmountWei,
  createConnectedAccount,
  createPayout,
  createTransfer,
} from "./stripe.service";

const WITHDRAWAL_FEE_MULTIPLIER = 0.005;

export class WithdrawalService {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  initiateWithdrawal(
    userId: bigint,
    input: InitiateWithdrawalRequest
  ): ResultAsync<{ withdrawalId: string; status: "processing" }, AppError> {
    const userRepo = new UserRepository(this.db);
    const walletRepo = new WalletRepository(this.db);
    const withdrawalRepo = new WithdrawalRepository(this.db);
    const blockchainTxRepo = new BlockchainTransactionRepository(this.db);

    const grossAmountCents = input.amountCents;
    const feeCents = Math.floor(grossAmountCents * WITHDRAWAL_FEE_MULTIPLIER);
    const netAmountCents = grossAmountCents - feeCents;
    const tokenAmountWei = calculateTokenAmountWei(grossAmountCents);

    return (
      userRepo
        .findById(userId)
        .andThen((user) => {
          if (!user || user.kycStatusId !== KYC_STATUS.VERIFIED) {
            return errAsync(new WithdrawalKycRequiredError());
          }
          return okAsync(user);
        })
        .andThen((user) =>
          walletRepo.findPrimaryByUserId(userId).andThen((wallet) => {
            if (!wallet) {
              return errAsync(new WalletNotFoundError("primary"));
            }
            if (
              wallet.walletType !== "CUSTODIAL" ||
              !wallet.encryptedPrivateKey
            ) {
              return errAsync(new WalletNotCustodialError(wallet.id.toString()));
            }
            return okAsync({ user, wallet });
          })
        )
        .andThen(({ user, wallet }) =>
          getOnChainBalance(wallet.address).andThen((balanceWei) => {
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
            return okAsync({ user, wallet });
          })
        )
        .andThen(({ user, wallet }) =>
          withdrawalRepo
            .create({
              userId,
              walletId: wallet.id,
              statusId: TRANSACTION_STATUS.PENDING,
              tokenAmount: tokenAmountWei,
              fiatAmountCents: BigInt(grossAmountCents),
              feeCents: BigInt(feeCents),
              payoutMethod: "bank_transfer",
            })
            .map((withdrawal) => ({ user, wallet, withdrawal }))
        )
        .andThen(({ user, wallet, withdrawal }) => {
          const privateKey = wallet.encryptedPrivateKey;
          if (!privateKey) {
            return errAsync(
              new WalletNotCustodialError(wallet.id.toString())
            );
          }
          return burnTokens(privateKey, tokenAmountWei)
            .mapErr((burnError) => {
              withdrawalRepo
                .updateStatus(withdrawal.id, TRANSACTION_STATUS.FAILED)
                .mapErr((err) =>
                  logger.error(
                    { error: err.toLog() },
                    "Failed to mark withdrawal as FAILED after burn error"
                  )
                );
              logger.error(
                { error: burnError.toLog(), withdrawalId: withdrawal.id.toString() },
                "Token burn failed — withdrawal marked FAILED"
              );
              return burnError;
            })
            .map((txHash) => ({ user, wallet, withdrawal, txHash }));
        })
        .andThen(({ user, wallet, withdrawal, txHash }) =>
          blockchainTxRepo
            .create({
              networkId: wallet.networkId,
              transactionTypeId: TRANSACTION_TYPE.BURN,
              fromAddress: wallet.address,
              toAddress: ZERO_ADDRESS,
              txHash,
              amount: tokenAmountWei,
              isConfirmed: true,
              confirmations: 1,
            })
            .map((blockchainTx) => ({ user, wallet, withdrawal, txHash, blockchainTx }))
        )
        .andThen(({ user, wallet, withdrawal, txHash, blockchainTx }) =>
          withdrawalRepo
            .markProcessing(withdrawal.id, blockchainTx.id)
            .map(() => ({ user, wallet, withdrawal, txHash, blockchainTx }))
        )
        .andThen(({ user, wallet, withdrawal, txHash, blockchainTx }) => {
          if (user.stripeConnectAccountId) {
            return okAsync({
              user,
              wallet,
              withdrawal,
              txHash,
              blockchainTx,
              connectAccountId: user.stripeConnectAccountId,
            });
          }
          return ResultAsync.fromPromise(
            createConnectedAccount(user.email),
            (e): AppError =>
              new ExternalServiceError(
                "Stripe",
                "Failed to create Stripe Connect account",
                { cause: e }
              )
          ).andThen((connectAccountId) =>
            userRepo
              .updateStripeConnectAccountId(userId, connectAccountId)
              .map(() => ({
                user,
                wallet,
                withdrawal,
                txHash,
                blockchainTx,
                connectAccountId,
              }))
          );
        })
        .andThen(({ user, wallet, withdrawal, txHash, blockchainTx, connectAccountId }) =>
          ResultAsync.fromPromise(
            addBankAccount(connectAccountId, {
              routingNumber: input.bankRoutingNumber,
              accountNumber: input.bankAccountNumber,
              accountHolderName: input.bankAccountHolderName,
              accountHolderType: input.bankAccountHolderType,
            }),
            (e): AppError =>
              new ExternalServiceError(
                "Stripe",
                "Failed to attach bank account to connected account",
                { cause: e }
              )
          ).map((bankAccountId) => ({
            user,
            wallet,
            withdrawal,
            txHash,
            blockchainTx,
            connectAccountId,
            bankAccountId,
          }))
        )
        .andThen(({ withdrawal, blockchainTx, connectAccountId }) => {
          const idempotencyBase = `withdrawal-${withdrawal.id.toString()}`;
          return ResultAsync.fromPromise(
            createTransfer(
              netAmountCents,
              connectAccountId,
              `${idempotencyBase}-transfer`
            ),
            (e): AppError =>
              new ExternalServiceError(
                "Stripe",
                "Failed to create platform transfer",
                { cause: e }
              )
          ).andThen((transferId) =>
            ResultAsync.fromPromise(
              createPayout(
                netAmountCents,
                connectAccountId,
                `${idempotencyBase}-payout`
              ),
              (e): AppError =>
                new ExternalServiceError(
                  "Stripe",
                  "Failed to initiate bank payout",
                  { cause: e }
                )
            ).map((payoutId) => ({ withdrawal, blockchainTx, transferId, payoutId }))
          );
        })
        .andThen(({ withdrawal, transferId, payoutId }) =>
          withdrawalRepo
            .complete(withdrawal.id, transferId, payoutId)
            .map(() => ({
              withdrawalId: withdrawal.publicId,
              status: "processing" as const,
            }))
        )
    );
  }
}
