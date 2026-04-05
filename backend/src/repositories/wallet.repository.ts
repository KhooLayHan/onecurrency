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
  async findById(
    id: bigint
  ): Promise<ResultAsync<Wallet | null, InternalError>> {
    return ResultAsync.fromPromise(
      this.db.query.wallets.findFirst({ where: eq(wallets.id, id) }),
      (e): InternalError =>
        new InternalError("Failed to fetch wallet from database", {
          cause: e,
          context: { walletId: id.toString() },
        })
    );
  }
  async findPrimaryByUserId(
    userId: bigint
  ): Promise<ResultAsync<Wallet | null, InternalError>> {
    return ResultAsync.fromPromise(
      this.db.query.wallets.findFirst({
        where: and(eq(wallets.userId, userId), eq(wallets.isPrimary, true)),
      }),
      (e): InternalError =>
        new InternalError("Failed to fetch primary wallet from database", {
          cause: e,
          context: { userId: userId.toString() },
        })
    );
  }
  async verifyOwnership(
    id: bigint,
    userId: bigint
  ): Promise<ResultAsync<boolean, InternalError>> {
    return this.findById(id).map(
      (wallet) => wallet?.userId === userId ?? false
    );
  }
  async requireOwnership(
    id: bigint,
    userId: bigint
  ): Promise<ResultAsync<Wallet, WalletNotFoundError | InternalError>> {
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
