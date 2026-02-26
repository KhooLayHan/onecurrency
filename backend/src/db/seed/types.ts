import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/src/db";
import { BATCH_SIZE } from "./helpers";

export async function batchInsert<T>(
  table: PgTable,
  records: T[],
  batchSize = BATCH_SIZE
): Promise<void> {
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await db
      .insert(table)
      .values(batch as Record<string, unknown>[])
      .onConflictDoNothing();
  }
}

export type SeededIds = {
  users: bigint[];
  wallets: bigint[];
  sessions: bigint[];
  accounts: bigint[];
  blockchainTransactions: bigint[];
  deposits: bigint[];
  verifications: bigint[];
  blacklistedAddresses: bigint[];
  webhookEvents: bigint[];
};

export type SeededData = {
  ids: SeededIds;
  userKycMap: Map<bigint, number>;
  walletNetworkMap: Map<bigint, number>;
};
