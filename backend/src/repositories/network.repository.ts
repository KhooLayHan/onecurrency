/**
 * Network repository.
 *
 * Data access for the `networks` table, which maps EVM chain IDs to their
 * on-chain configuration (contract address, RPC URL, explorer URL).
 */
import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { InternalError } from "@/common/errors/infrastructure";
import type { Database } from "../db";
import { type Network, networks } from "../db/schema/networks";

export class NetworkRepository {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  /**
   * Finds a network record by its EVM chain ID.
   *
   * Returns `null` when no network with the given chain ID is configured
   * in the database.
   *
   * @param chainId - The EVM chain ID to look up (e.g. `11155111n` for Sepolia).
   * @returns The matching network row, or `null`.
   */
  findByChainId(chainId: bigint): ResultAsync<Network | null, InternalError> {
    return ResultAsync.fromPromise(
      this.db
        .select()
        .from(networks)
        .where(eq(networks.chainId, chainId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      (e): InternalError =>
        new InternalError("Failed to find network by chain ID", {
          cause: e,
          context: { chainId: chainId.toString() },
        })
    );
  }
}
