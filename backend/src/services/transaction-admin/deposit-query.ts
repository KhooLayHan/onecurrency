/**
 * Admin deposit queries.
 *
 * Provides count, unbounded fetch, paginated query, single-record lookup,
 * and WHERE-clause builder for the deposits table.
 *
 * All functions receive the Drizzle `Database` instance as a parameter so
 * they remain pure and easily testable without class instantiation.
 */
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  type SQL,
} from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { InternalError } from "@/common/errors/infrastructure";
import type { Database } from "../../db";
import { blockchainTransactions } from "../../db/schema/blockchain-transactions";
import { deposits } from "../../db/schema/deposits";
import { transactionStatuses } from "../../db/schema/transaction-statuses";
import { users } from "../../db/schema/users";
import {
  type AdminTransactionItem,
  compact,
  type ListFilters,
  type ListResult,
  toCents,
  validateStatus,
} from "./types";

/**
 * Builds the Drizzle SQL WHERE clause for deposit list and count queries.
 *
 * @param filters - Active filter values from the API request.
 * @returns A composed SQL condition, or `undefined` when no filters are set
 *          (which tells Drizzle to omit the WHERE clause entirely).
 */
export function buildDepositWhere(filters: ListFilters): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.statusId !== undefined) {
    conditions.push(eq(deposits.statusId, filters.statusId));
  }
  if (filters.dateFrom) {
    conditions.push(gte(deposits.createdAt, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(deposits.createdAt, filters.dateTo));
  }
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      or(ilike(users.name, term), ilike(users.email, term)) as SQL
    );
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

/**
 * Returns the total number of deposits that match the given filters.
 * Used alongside `queryDeposits` to populate pagination metadata.
 *
 * @param db      - Drizzle database instance.
 * @param filters - Active filter values.
 * @returns Total matching row count.
 */
export async function countDeposits(
  db: Database,
  filters: ListFilters
): Promise<number> {
  const where = buildDepositWhere(filters);
  const query = db
    .select({ count: count() })
    .from(deposits)
    .innerJoin(users, eq(deposits.userId, users.id));
  const [result] = where ? await query.where(where) : await query;
  return result?.count ?? 0;
}

/**
 * Fetches all deposits matching the filters with no pagination limit.
 *
 * Called by `listAllTypes` in the main service, which merges all three
 * transaction types, sorts them by `createdAt` descending, and then applies
 * pagination in memory.
 *
 * @param db      - Drizzle database instance.
 * @param filters - Active filter values.
 * @returns Array of normalised `AdminTransactionItem` rows (type = "add_money").
 */
export async function fetchDeposits(
  db: Database,
  filters: ListFilters
): Promise<AdminTransactionItem[]> {
  const where = buildDepositWhere(filters);
  const base = db
    .select({
      publicId: deposits.publicId,
      amountCents: deposits.netAmountCents,
      feeCents: deposits.feeCents,
      status: transactionStatuses.name,
      createdAt: deposits.createdAt,
      completedAt: deposits.completedAt,
      userPublicId: users.publicId,
      userName: users.name,
      userEmail: users.email,
      blockchainTxHash: blockchainTransactions.txHash,
    })
    .from(deposits)
    .innerJoin(users, eq(deposits.userId, users.id))
    .innerJoin(
      transactionStatuses,
      eq(deposits.statusId, transactionStatuses.id)
    )
    .leftJoin(
      blockchainTransactions,
      eq(deposits.blockchainTxId, blockchainTransactions.id)
    )
    .orderBy(desc(deposits.createdAt));

  const rows = where ? await base.where(where) : await base;

  return compact(
    rows.map((row) => {
      const status = validateStatus(row.status);
      if (!status) {
        return null;
      }
      return {
        publicId: row.publicId,
        type: "add_money" as const,
        amountCents: toCents(row.amountCents),
        feeCents: toCents(row.feeCents),
        status,
        createdAt: row.createdAt,
        completedAt: row.completedAt,
        userPublicId: row.userPublicId,
        userName: row.userName,
        userEmail: row.userEmail,
        counterpartyPublicId: null,
        counterpartyName: null,
        blockchainTxHash: row.blockchainTxHash,
      } satisfies AdminTransactionItem;
    })
  );
}

/**
 * Returns a paginated list of deposits along with the total matching count.
 *
 * Used when the caller explicitly filters by `type = "add_money"`, allowing
 * the DB to apply LIMIT/OFFSET directly instead of in-memory slicing.
 *
 * @param db      - Drizzle database instance.
 * @param filters - Active filter values.
 * @param limit   - Maximum number of rows to return.
 * @param offset  - Number of rows to skip (for pagination).
 * @returns `Ok(ListResult)` on success or `InternalError` on DB failure.
 */
export function queryDeposits(
  db: Database,
  filters: ListFilters,
  limit: number,
  offset: number
): ResultAsync<ListResult, InternalError> {
  const where = buildDepositWhere(filters);
  const base = db
    .select({
      publicId: deposits.publicId,
      amountCents: deposits.netAmountCents,
      feeCents: deposits.feeCents,
      status: transactionStatuses.name,
      createdAt: deposits.createdAt,
      completedAt: deposits.completedAt,
      userPublicId: users.publicId,
      userName: users.name,
      userEmail: users.email,
      blockchainTxHash: blockchainTransactions.txHash,
    })
    .from(deposits)
    .innerJoin(users, eq(deposits.userId, users.id))
    .innerJoin(
      transactionStatuses,
      eq(deposits.statusId, transactionStatuses.id)
    )
    .leftJoin(
      blockchainTransactions,
      eq(deposits.blockchainTxId, blockchainTransactions.id)
    )
    .orderBy(desc(deposits.createdAt))
    .limit(limit)
    .offset(offset);

  return ResultAsync.fromPromise(
    Promise.all([countDeposits(db, filters), where ? base.where(where) : base]),
    (e): InternalError =>
      new InternalError("Failed to fetch deposit list", { cause: e })
  ).map(([total, rows]) => ({
    items: compact(
      rows.map((row) => {
        const status = validateStatus(row.status);
        if (!status) {
          return null;
        }
        return {
          publicId: row.publicId,
          type: "add_money" as const,
          amountCents: toCents(row.amountCents),
          feeCents: toCents(row.feeCents),
          status,
          createdAt: row.createdAt,
          completedAt: row.completedAt,
          userPublicId: row.userPublicId,
          userName: row.userName,
          userEmail: row.userEmail,
          counterpartyPublicId: null,
          counterpartyName: null,
          blockchainTxHash: row.blockchainTxHash,
        } satisfies AdminTransactionItem;
      })
    ),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
  }));
}

/**
 * Fetches a single deposit by its public ID.
 *
 * @param db       - Drizzle database instance.
 * @param publicId - The deposit's UUID public identifier.
 * @returns The matching `AdminTransactionItem`, or `null` if not found.
 */
export async function findDeposit(
  db: Database,
  publicId: string
): Promise<AdminTransactionItem | null> {
  const [row] = await db
    .select({
      publicId: deposits.publicId,
      amountCents: deposits.netAmountCents,
      feeCents: deposits.feeCents,
      status: transactionStatuses.name,
      createdAt: deposits.createdAt,
      completedAt: deposits.completedAt,
      userPublicId: users.publicId,
      userName: users.name,
      userEmail: users.email,
      blockchainTxHash: blockchainTransactions.txHash,
    })
    .from(deposits)
    .innerJoin(users, eq(deposits.userId, users.id))
    .innerJoin(
      transactionStatuses,
      eq(deposits.statusId, transactionStatuses.id)
    )
    .leftJoin(
      blockchainTransactions,
      eq(deposits.blockchainTxId, blockchainTransactions.id)
    )
    .where(eq(deposits.publicId, publicId));

  if (!row) {
    return null;
  }

  const status = validateStatus(row.status);
  if (!status) {
    return null;
  }

  return {
    publicId: row.publicId,
    type: "add_money",
    amountCents: toCents(row.amountCents),
    feeCents: toCents(row.feeCents),
    status,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    userPublicId: row.userPublicId,
    userName: row.userName,
    userEmail: row.userEmail,
    counterpartyPublicId: null,
    counterpartyName: null,
    blockchainTxHash: row.blockchainTxHash,
  };
}
