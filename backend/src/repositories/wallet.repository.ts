import { and, eq } from "drizzle-orm";
import { type Database, db } from "../db";
import type { Wallet } from "../db/schema/wallets";
import { wallets } from "../db/schema/wallets";

export class WalletRepository {
  private readonly db: Database;
  constructor(_db: Database) {
    this.db = _db;
  }

  async findById(id: bigint): Promise<Wallet | null> {
    return (
      (await this.db._query.wallets.findFirst({
        where: eq(wallets.id, id),
      })) ?? null
    );
  }

  async findPrimaryByUserId(userId: bigint): Promise<Wallet | null> {
    return (
      (await this.db._query.wallets.findFirst({
        where: and(eq(wallets.userId, userId), eq(wallets.isPrimary, true)),
      })) ?? null
    );
  }

  async verifyOwnership(id: bigint, userId: bigint): Promise<boolean> {
    const wallet = await this.findById(id);
    return wallet?.userId === userId;
  }
}

export const walletRepository = new WalletRepository(db);
