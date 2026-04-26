import { desc, eq } from "drizzle-orm";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { DepositNotFoundError } from "@/common/errors/deposit";
import { InternalError } from "@/common/errors/infrastructure";
import type { TransactionStatusId } from "../constants/transaction-status";
import type { Database } from "../db";
import { type Deposit, deposits, type NewDeposit } from "../db/schema/deposits";

const STATUS_ID_TO_NAME: Record<number, string> = {
  1: "pending",
  2: "processing",
  3: "completed",
  4: "failed",
  5: "refunded",
};

export type DepositHistoryItem = {
  id: string;
  publicId: string;
  type: "add_money";
  amountCents: number;
  status: "pending" | "processing" | "completed" | "failed" | "refunded";
  createdAt: Date;
};

export class DepositRepository {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  findByUserId(
    userId: bigint
  ): ResultAsync<DepositHistoryItem[], InternalError> {
    return ResultAsync.fromPromise(
      this.db
        .select({
          id: deposits.id,
          publicId: deposits.publicId,
          amountCents: deposits.netAmountCents,
          statusId: deposits.statusId,
          createdAt: deposits.createdAt,
        })
        .from(deposits)
        .where(eq(deposits.userId, userId))
        .orderBy(desc(deposits.createdAt)),
      (e): InternalError =>
        new InternalError("Failed to fetch deposit history", {
          cause: e,
          context: { userId: userId.toString() },
        })
    ).map((rows) =>
      rows.map((row) => ({
        id: row.id.toString(),
        publicId: row.publicId,
        type: "add_money" as const,
        amountCents: Number(row.amountCents ?? 0n),
        status: (STATUS_ID_TO_NAME[row.statusId] ??
          "pending") as DepositHistoryItem["status"],
        createdAt: row.createdAt,
      }))
    );
  }

  create(data: NewDeposit): ResultAsync<Deposit, InternalError> {
    return ResultAsync.fromPromise(
      this.db
        .insert(deposits)
        .values(data)
        .returning()
        .then((rows) => rows[0]),
      (e): InternalError =>
        new InternalError("Failed to create deposit record", {
          cause: e,
          context: {
            userId: data.userId?.toString(),
            walletId: data.walletId?.toString(),
          },
        })
    ).andThen((deposit) => {
      if (!deposit) {
        return errAsync(
          new InternalError("Deposit not returned after insert", {
            context: { userId: data.userId?.toString() },
          })
        );
      }
      return okAsync(deposit);
    });
  }

  updateStatus(
    id: bigint,
    statusId: TransactionStatusId
  ): ResultAsync<void, DepositNotFoundError | InternalError> {
    return ResultAsync.fromPromise(
      this.db
        .update(deposits)
        .set({ statusId })
        .where(eq(deposits.id, id))
        .returning({ id: deposits.id }),
      (e): InternalError =>
        new InternalError("Failed to update deposit status", {
          cause: e,
          context: { depositId: id.toString(), statusId },
        })
    ).andThen((rows) => {
      if (rows.length === 0) {
        return errAsync(new DepositNotFoundError(id.toString()));
      }
      return okAsync(undefined);
    });
  }

  complete(
    id: bigint,
    blockchainTxId: bigint
  ): ResultAsync<void, DepositNotFoundError | InternalError> {
    return ResultAsync.fromPromise(
      this.db
        .update(deposits)
        .set({
          blockchainTxId,
          completedAt: new Date(),
        })
        .where(eq(deposits.id, id))
        .returning({ id: deposits.id }),
      (e): InternalError =>
        new InternalError("Failed to complete deposit", {
          cause: e,
          context: {
            depositId: id.toString(),
            blockchainTxId: blockchainTxId.toString(),
          },
        })
    ).andThen((rows) => {
      if (rows.length === 0) {
        return errAsync(new DepositNotFoundError(id.toString()));
      }
      return okAsync(undefined);
    });
  }
}
