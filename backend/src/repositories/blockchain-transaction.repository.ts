import { eq } from "drizzle-orm";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { InternalError } from "@/common/errors/infrastructure";
import type { Database } from "../db";
import {
  type BlockchainTransaction,
  blockchainTransactions,
  type NewBlockchainTransaction,
} from "../db/schema/blockchain-transactions";

export class BlockchainTransactionRepository {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  create(
    data: NewBlockchainTransaction
  ): ResultAsync<BlockchainTransaction, InternalError> {
    return ResultAsync.fromPromise(
      this.db
        .insert(blockchainTransactions)
        .values(data)
        .onConflictDoNothing()
        .returning()
        .then((rows) => rows[0]),
      (e): InternalError =>
        new InternalError("Failed to create blockchain transaction record", {
          cause: e,
          context: {
            networkId: data.networkId,
            txHash: data.txHash,
            toAddress: data.toAddress,
          },
        })
    ).andThen((tx) => {
      if (tx) {
        return okAsync(tx);
      }

      // Insert was skipped because of a conflict — fetch the existing row
      return ResultAsync.fromPromise(
        this.db
          .select()
          .from(blockchainTransactions)
          .where(eq(blockchainTransactions.txHash, data.txHash))
          .then((rows) => rows[0] ?? null),
        (e): InternalError =>
          new InternalError(
            "Failed to retrieve existing blockchain transaction record",
            {
              cause: e,
              context: { txHash: data.txHash },
            }
          )
      ).andThen((existing) => {
        if (existing) {
          return okAsync(existing);
        }
        return errAsync(
          new InternalError(
            "Blockchain transaction record missing after insert conflict",
            { context: { txHash: data.txHash } }
          )
        );
      });
    });
  }
}
