import { eq } from "drizzle-orm";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { DepositNotFoundError } from "@/common/errors/deposit";
import { InternalError } from "@/common/errors/infrastructure";
import type { TransactionStatusId } from "../constants/transaction-status";
import type { Database } from "../db";
import { type Deposit, deposits, type NewDeposit } from "../db/schema/deposits";

export class DepositRepository {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
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
