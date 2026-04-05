import { and, eq } from "drizzle-orm";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { InternalError } from "@/common/errors/infrastructure";
import { WalletNotFoundError } from "@/common/errors/wallet";
import type { Database } from "../db";
import { type Wallet, wallets } from "../db/schema/wallets";

export class WalletRepository {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  findById(id: bigint): ResultAsync<Wallet | null, InternalError> {
    return ResultAsync.fromPromise(
      this.db._query.wallets.findFirst({ where: eq(wallets.id, id) }),
      (e): InternalError =>
        new InternalError("Failed to fetch wallet from database", {
          cause: e,
          context: { walletId: id.toString() },
        })
    ).map((wallet) => wallet ?? null);
  }

  findPrimaryByUserId(
    userId: bigint
  ): ResultAsync<Wallet | null, InternalError> {
    return ResultAsync.fromPromise(
      this.db._query.wallets.findFirst({
        where: and(eq(wallets.userId, userId), eq(wallets.isPrimary, true)),
      }),
      (e): InternalError =>
        new InternalError("Failed to fetch primary wallet from database", {
          cause: e,
          context: { userId: userId.toString() },
        })
    ).map((wallet) => wallet ?? null);
  }

  verifyOwnership(
    id: bigint,
    userId: bigint
  ): ResultAsync<boolean, InternalError> {
    return this.findById(id).map((wallet) => wallet?.userId === userId);
  }

  requireOwnership(
    id: bigint,
    userId: bigint
  ): ResultAsync<Wallet, WalletNotFoundError | InternalError> {
    return this.findById(id).andThen((wallet) => {
      if (!wallet) {
        return errAsync(new WalletNotFoundError(id.toString()));
      }
      if (wallet.userId !== userId) {
        return errAsync(new WalletNotFoundError(id.toString()));
      }
      return okAsync(wallet);
    });
  }
}
