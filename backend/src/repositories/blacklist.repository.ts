import { and, desc, eq, ilike, type SQL, sql } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { InternalError } from "@/common/errors/infrastructure";
import type { Database } from "../db";
import {
  type BlacklistedAddress,
  blacklistedAddresses,
  type NewBlacklistedAddress,
} from "../db/schema/blacklisted-addresses";
import { networks } from "../db/schema/networks";
import { users } from "../db/schema/users";

type ListFilters = {
  networkId?: number;
  search?: string;
  page: number;
  pageSize: number;
};

export type BlacklistedAddressWithMeta = BlacklistedAddress & {
  networkName: string | null;
  addedByName: string | null;
};

type CreateInput = {
  address: string;
  networkId: number;
  reason: string;
  source?: string;
  addedByUserId: bigint;
};

export class BlacklistRepository {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  list(
    filters: ListFilters
  ): ResultAsync<
    { items: BlacklistedAddressWithMeta[]; total: number },
    InternalError
  > {
    const conditions: SQL[] = [];
    if (filters.networkId) {
      conditions.push(eq(blacklistedAddresses.networkId, filters.networkId));
    }
    if (filters.search) {
      conditions.push(
        ilike(blacklistedAddresses.address, `%${filters.search}%`)
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (filters.page - 1) * filters.pageSize;

    return ResultAsync.fromPromise(
      Promise.all([
        this.db
          .select({
            id: blacklistedAddresses.id,
            publicId: blacklistedAddresses.publicId,
            address: blacklistedAddresses.address,
            networkId: blacklistedAddresses.networkId,
            reason: blacklistedAddresses.reason,
            source: blacklistedAddresses.source,
            addedByUserId: blacklistedAddresses.addedByUserId,
            createdAt: blacklistedAddresses.createdAt,
            expiresAt: blacklistedAddresses.expiresAt,
            networkName: networks.name,
            addedByName: users.name,
          })
          .from(blacklistedAddresses)
          .leftJoin(networks, eq(blacklistedAddresses.networkId, networks.id))
          .leftJoin(users, eq(blacklistedAddresses.addedByUserId, users.id))
          .where(where)
          .orderBy(desc(blacklistedAddresses.id))
          .limit(filters.pageSize)
          .offset(offset),
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(blacklistedAddresses)
          .where(where),
      ]),
      (e): InternalError =>
        new InternalError("Failed to list blacklisted addresses", { cause: e })
    ).map(([items, countRows]) => ({
      items: items as BlacklistedAddressWithMeta[],
      total: countRows[0]?.count ?? 0,
    }));
  }

  findByPublicId(
    publicId: string
  ): ResultAsync<BlacklistedAddress | null, InternalError> {
    return ResultAsync.fromPromise(
      this.db._query.blacklistedAddresses.findFirst({
        where: eq(blacklistedAddresses.publicId, publicId),
      }),
      (e): InternalError =>
        new InternalError("Failed to find blacklisted address", { cause: e })
    ).map((r) => r ?? null);
  }

  findByAddress(
    address: string,
    networkId: number
  ): ResultAsync<BlacklistedAddress | null, InternalError> {
    return ResultAsync.fromPromise(
      this.db._query.blacklistedAddresses.findFirst({
        where: and(
          eq(
            sql`LOWER(${blacklistedAddresses.address})`,
            address.toLowerCase()
          ),
          eq(blacklistedAddresses.networkId, networkId)
        ),
      }),
      (e): InternalError =>
        new InternalError("Failed to look up blacklisted address", {
          cause: e,
        })
    ).map((r) => r ?? null);
  }

  create(input: CreateInput): ResultAsync<BlacklistedAddress, InternalError> {
    const record: NewBlacklistedAddress = {
      address: input.address,
      networkId: input.networkId,
      reason: input.reason,
      source: input.source,
      addedByUserId: input.addedByUserId,
    };
    return ResultAsync.fromPromise(
      (async () => {
        const rows = await this.db
          .insert(blacklistedAddresses)
          .values(record)
          .returning();
        const row = rows[0];
        if (!row) {
          throw new Error("Insert returned no rows");
        }
        return row;
      })(),
      (e): InternalError =>
        new InternalError("Failed to create blacklist entry", { cause: e })
    );
  }

  deleteByPublicId(publicId: string): ResultAsync<void, InternalError> {
    return ResultAsync.fromPromise(
      (async () => {
        await this.db
          .delete(blacklistedAddresses)
          .where(eq(blacklistedAddresses.publicId, publicId));
      })(),
      (e): InternalError =>
        new InternalError("Failed to delete blacklist entry", { cause: e })
    );
  }
}
