/**
 * Admin withdrawal queries.
 *
 * Provides count, unbounded fetch, paginated query, single-record lookup,
 * and WHERE-clause builder for the withdrawals table.
 *
 * Mirrors the structure of `deposit-query.ts`. The only meaningful differences
 * are the table name, the transaction `type` literal ("cash_out"), and the
 * status column reference.
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
import { transactionStatuses } from "../../db/schema/transaction-statuses";
import { users } from "../../db/schema/users";
import { withdrawals } from "../../db/schema/withdrawals";
import {
  type AdminTransactionItem,
  compact,
  type ListFilters,
  type ListResult,
  toCents,
  validateStatus,
} from "./types";

/**
 * Builds the Drizzle SQL WHERE clause for withdrawal list and count queries.
 *
 * @param filters - Active filter values from the API request.
 * @returns A composed SQL condition, or `undefined` when no filters are set.
 */
export function buildWithdrawalWhere(filters: ListFilters): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.statusId) {
    conditions.push(eq(withdrawals.statusId, filters.statusId));
  }
  if (filters.dateFrom) {
    conditions.push(gte(withdrawals.createdAt, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(withdrawals.createdAt, filters.dateTo));
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
 * Returns the total number of withdrawals that match the given filters.
 * Used alongside `queryWithdrawals` to populate pagination metadata.
 *
 * @param db      - Drizzle database instance.
 * @param filters - Active filter values.
 * @returns Total matching row count.
 */
export async function countWithdrawals(
  db: Database,
  filters: ListFilters
): Promise<number> {
  const where = buildWithdrawalWhere(filters);
  const query = db
    .select({ count: count() })
    .from(withdrawals)
    .innerJoin(users, eq(withdrawals.userId, users.id));
  const [result] = where ? await query.where(where) : await query;
  return result?.count ?? 0;
}

/**
 * Fetches all withdrawals matching the filters with no pagination limit.
 *
 * Called by `listAllTypes` in the main service, which merges all three
 * transaction types, sorts them by `createdAt` descending, and then applies
 * pagination in memory.
 *
 * @param db      - Drizzle database instance.
 * @param filters - Active filter values.
 * @returns Array of normalised `AdminTransactionItem` rows (type = "cash_out").
 */
export async function fetchWithdrawals(
  db: Database,
  filters: ListFilters
): Promise<AdminTransactionItem[]> {
  const where = buildWithdrawalWhere(filters);
  const base = db
    .select({
      publicId: withdrawals.publicId,
      amountCents: withdrawals.netAmountCents,
      feeCents: withdrawals.feeCents,
      status: transactionStatuses.name,
      createdAt: withdrawals.createdAt,
      completedAt: withdrawals.completedAt,
      userPublicId: users.publicId,
      userName: users.name,
      userEmail: users.email,
      blockchainTxHash: blockchainTransactions.txHash,
    })
    .from(withdrawals)
    .innerJoin(users, eq(withdrawals.userId, users.id))
    .innerJoin(
      transactionStatuses,
      eq(withdrawals.statusId, transactionStatuses.id)
    )
    .leftJoin(
      blockchainTransactions,
      eq(withdrawals.blockchainTxId, blockchainTransactions.id)
    )
    .orderBy(desc(withdrawals.createdAt));

  const rows = where ? await base.where(where) : await base;

  return compact(
    rows.map((row) => {
      const status = validateStatus(row.status);
      if (!status) {
        return null;
      }
      return {
        publicId: row.publicId,
        type: "cash_out" as const,
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
 * Returns a paginated list of withdrawals along with the total matching count.
 *
 * Used when the caller explicitly filters by `type = "cash_out"`, allowing
 * the DB to apply LIMIT/OFFSET directly instead of in-memory slicing.
 *
 * @param db      - Drizzle database instance.
 * @param filters - Active filter values.
 * @param limit   - Maximum number of rows to return.
 * @param offset  - Number of rows to skip (for pagination).
 * @returns `Ok(ListResult)` on success or `InternalError` on DB failure.
 */
export function queryWithdrawals(
  db: Database,
  filters: ListFilters,
  limit: number,
  offset: number
): ResultAsync<ListResult, InternalError> {
  const where = buildWithdrawalWhere(filters);
  const base = db
    .select({
      publicId: withdrawals.publicId,
      amountCents: withdrawals.netAmountCents,
      feeCents: withdrawals.feeCents,
      status: transactionStatuses.name,
      createdAt: withdrawals.createdAt,
      completedAt: withdrawals.completedAt,
      userPublicId: users.publicId,
      userName: users.name,
      userEmail: users.email,
      blockchainTxHash: blockchainTransactions.txHash,
    })
    .from(withdrawals)
    .innerJoin(users, eq(withdrawals.userId, users.id))
    .innerJoin(
      transactionStatuses,
      eq(withdrawals.statusId, transactionStatuses.id)
    )
    .leftJoin(
      blockchainTransactions,
      eq(withdrawals.blockchainTxId, blockchainTransactions.id)
    )
    .orderBy(desc(withdrawals.createdAt))
    .limit(limit)
    .offset(offset);

  return ResultAsync.fromPromise(
    Promise.all([
      countWithdrawals(db, filters),
      where ? base.where(where) : base,
    ]),
    (e): InternalError =>
      new InternalError("Failed to fetch withdrawal list", { cause: e })
  ).map(([total, rows]) => ({
    items: compact(
      rows.map((row) => {
        const status = validateStatus(row.status);
        if (!status) {
          return null;
        }
        return {
          publicId: row.publicId,
          type: "cash_out" as const,
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
 * Fetches a single withdrawal by its public ID.
 *
 * @param db       - Drizzle database instance.
 * @param publicId - The withdrawal's UUID public identifier.
 * @returns The matching `AdminTransactionItem`, or `null` if not found.
 */
export async function findWithdrawal(
  db: Database,
  publicId: string
): Promise<AdminTransactionItem | null> {
  const [row] = await db
    .select({
      publicId: withdrawals.publicId,
      amountCents: withdrawals.netAmountCents,
      feeCents: withdrawals.feeCents,
      status: transactionStatuses.name,
      createdAt: withdrawals.createdAt,
      completedAt: withdrawals.completedAt,
      userPublicId: users.publicId,
      userName: users.name,
      userEmail: users.email,
      blockchainTxHash: blockchainTransactions.txHash,
    })
    .from(withdrawals)
    .innerJoin(users, eq(withdrawals.userId, users.id))
    .innerJoin(
      transactionStatuses,
      eq(withdrawals.statusId, transactionStatuses.id)
    )
    .leftJoin(
      blockchainTransactions,
      eq(withdrawals.blockchainTxId, blockchainTransactions.id)
    )
    .where(eq(withdrawals.publicId, publicId));

  if (!row) {
    return null;
  }

  const status = validateStatus(row.status);
  if (!status) {
    return null;
  }

  return {
    publicId: row.publicId,
    type: "cash_out",
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
