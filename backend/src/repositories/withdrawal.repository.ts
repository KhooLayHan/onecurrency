import { desc, eq } from "drizzle-orm";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { InternalError } from "@/common/errors/infrastructure";
import { WithdrawalNotFoundError } from "@/common/errors/withdrawal";
import {
  TRANSACTION_STATUS,
  type TransactionStatusId,
} from "../constants/transaction-status";
import type { Database } from "../db";
import { transactionStatuses } from "../db/schema/transaction-statuses";
import {
  type NewWithdrawal,
  type Withdrawal,
  withdrawals,
} from "../db/schema/withdrawals";

export type WithdrawalHistoryItem = {
  id: string;
  publicId: string;
  type: "cash_out";
  amountCents: number;
  status: "pending" | "processing" | "completed" | "failed" | "refunded";
  createdAt: Date;
};

export class WithdrawalRepository {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  findByUserId(
    userId: bigint
  ): ResultAsync<WithdrawalHistoryItem[], InternalError> {
    return ResultAsync.fromPromise(
      this.db
        .select({
          id: withdrawals.id,
          publicId: withdrawals.publicId,
          amountCents: withdrawals.netAmountCents,
          status: transactionStatuses.name,
          createdAt: withdrawals.createdAt,
        })
        .from(withdrawals)
        .innerJoin(
          transactionStatuses,
          eq(withdrawals.statusId, transactionStatuses.id)
        )
        .where(eq(withdrawals.userId, userId))
        .orderBy(desc(withdrawals.createdAt)),
      (e): InternalError =>
        new InternalError("Failed to fetch withdrawal history", {
          cause: e,
          context: { userId: userId.toString() },
        })
    ).map((rows) =>
      rows.map((row) => {
        const status = row.status.toLowerCase();
        if (
          status !== "pending" &&
          status !== "processing" &&
          status !== "completed" &&
          status !== "failed" &&
          status !== "refunded"
        ) {
          throw new InternalError("Unknown transaction status from DB", {
            context: { status: row.status },
          });
        }
        return {
          id: row.id.toString(),
          publicId: row.publicId,
          type: "cash_out" as const,
          amountCents: Number(row.amountCents ?? 0n),
          status,
          createdAt: row.createdAt,
        };
      })
    );
  }

  create(data: NewWithdrawal): ResultAsync<Withdrawal, InternalError> {
    return ResultAsync.fromPromise(
      this.db
        .insert(withdrawals)
        .values(data)
        .returning()
        .then((rows) => rows[0]),
      (e): InternalError =>
        new InternalError("Failed to create withdrawal record", {
          cause: e,
          context: {
            userId: data.userId?.toString(),
            walletId: data.walletId?.toString(),
          },
        })
    ).andThen((withdrawal) => {
      if (!withdrawal) {
        return errAsync(
          new InternalError("Withdrawal not returned after insert", {
            context: { userId: data.userId?.toString() },
          })
        );
      }
      return okAsync(withdrawal);
    });
  }

  updateStatus(
    id: bigint,
    statusId: TransactionStatusId
  ): ResultAsync<void, WithdrawalNotFoundError | InternalError> {
    return ResultAsync.fromPromise(
      this.db
        .update(withdrawals)
        .set({ statusId })
        .where(eq(withdrawals.id, id))
        .returning({ id: withdrawals.id }),
      (e): InternalError =>
        new InternalError("Failed to update withdrawal status", {
          cause: e,
          context: { withdrawalId: id.toString(), statusId },
        })
    ).andThen((rows) => {
      if (rows.length === 0) {
        return errAsync(new WithdrawalNotFoundError(id.toString()));
      }
      return okAsync(undefined);
    });
  }

  markProcessing(
    id: bigint,
    blockchainTxId: bigint
  ): ResultAsync<void, WithdrawalNotFoundError | InternalError> {
    return ResultAsync.fromPromise(
      this.db
        .update(withdrawals)
        .set({
          statusId: TRANSACTION_STATUS.PROCESSING,
          blockchainTxId,
        })
        .where(eq(withdrawals.id, id))
        .returning({ id: withdrawals.id }),
      (e): InternalError =>
        new InternalError("Failed to mark withdrawal as processing", {
          cause: e,
          context: {
            withdrawalId: id.toString(),
            blockchainTxId: blockchainTxId.toString(),
          },
        })
    ).andThen((rows) => {
      if (rows.length === 0) {
        return errAsync(new WithdrawalNotFoundError(id.toString()));
      }
      return okAsync(undefined);
    });
  }

  complete(
    id: bigint,
    stripeTransferId: string,
    stripePayoutId: string
  ): ResultAsync<void, WithdrawalNotFoundError | InternalError> {
    return ResultAsync.fromPromise(
      this.db
        .update(withdrawals)
        .set({
          statusId: TRANSACTION_STATUS.COMPLETED,
          stripeTransferId,
          stripePayoutId,
          completedAt: new Date(),
        })
        .where(eq(withdrawals.id, id))
        .returning({ id: withdrawals.id }),
      (e): InternalError =>
        new InternalError("Failed to complete withdrawal", {
          cause: e,
          context: { withdrawalId: id.toString() },
        })
    ).andThen((rows) => {
      if (rows.length === 0) {
        return errAsync(new WithdrawalNotFoundError(id.toString()));
      }
      return okAsync(undefined);
    });
  }
}
