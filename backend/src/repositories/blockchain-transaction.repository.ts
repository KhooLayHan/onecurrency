import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { InternalError } from "@/common/errors/infrastructure";
import type { Database } from "../db";
import {
  type BlockchainTransaction,
  blockchainTransactions,
  type NewBlockchainTransaction,
} from "../db/schema/blockchain-transactions";

type NewBlockchainTxData = {
  networkId: number;
  transactionTypeId: TransactionTypeId;
  fromAddress: string;
  toAddress: string;
  txHash: string;
  amount: string;
  isConfirmed: boolean;
  confirmations: number;
};

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
      if (!tx) {
        return errAsync(
          new InternalError(
            "Blockchain transaction not returned after insert",
            { context: { txHash: data.txHash } }
          )
        );
      }
      return okAsync(tx);
    });
  }
}
