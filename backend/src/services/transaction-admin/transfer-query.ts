/**
 * Admin transfer queries.
 *
 * Provides count, unbounded fetch, paginated query, single-record lookup,
 * and WHERE-clause builder for the transfers table.
 *
 * Transfers are more complex than deposits/withdrawals because they involve
 * two users (sender + receiver), requiring two aliased joins on the `users`
 * table. The `UserAlias` type from `types.ts` captures this aliased shape and
 * is passed explicitly to the WHERE builder so the correct alias columns are
 * referenced in search conditions.
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
import { alias } from "drizzle-orm/pg-core";
import { ResultAsync } from "neverthrow";
import { InternalError } from "@/common/errors/infrastructure";
import type { Database } from "../../db";
import { blockchainTransactions } from "../../db/schema/blockchain-transactions";
import { transactionStatuses } from "../../db/schema/transaction-statuses";
import { transfers } from "../../db/schema/transfers";
import { users } from "../../db/schema/users";
import {
  type AdminTransactionItem,
  compact,
  type ListFilters,
  type ListResult,
  toCents,
  type UserAlias,
  validateStatus,
} from "./types";

/**
 * Builds the Drizzle SQL WHERE clause for transfer list and count queries.
 *
 * Requires the two user aliases so that text search terms are matched against
 * both the sender's and receiver's name and email columns.
 *
 * @param filters      - Active filter values from the API request.
 * @param senderUser   - Drizzle alias for the sender's `users` row.
 * @param receiverUser - Drizzle alias for the receiver's `users` row.
 * @returns A composed SQL condition, or `undefined` when no filters are set.
 */
export function buildTransferWhere(
  filters: ListFilters,
  senderUser: UserAlias,
  receiverUser: UserAlias
): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.statusId !== undefined) {
    conditions.push(eq(transfers.statusId, filters.statusId));
  }
  if (filters.dateFrom) {
    conditions.push(gte(transfers.createdAt, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(transfers.createdAt, filters.dateTo));
  }
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(senderUser.name, term),
        ilike(senderUser.email, term),
        ilike(receiverUser.name, term),
        ilike(receiverUser.email, term)
      ) as SQL
    );
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

/**
 * Returns the total number of transfers that match the given filters.
 * Used alongside `queryTransfers` to populate pagination metadata.
 *
 * @param db      - Drizzle database instance.
 * @param filters - Active filter values.
 * @returns Total matching row count.
 */
export async function countTransfers(
  db: Database,
  filters: ListFilters
): Promise<number> {
  const senderUser = alias(users, "sender_user");
  const receiverUser = alias(users, "receiver_user");
  const where = buildTransferWhere(filters, senderUser, receiverUser);

  const query = db
    .select({ count: count() })
    .from(transfers)
    .innerJoin(senderUser, eq(transfers.senderUserId, senderUser.id))
    .leftJoin(receiverUser, eq(transfers.receiverUserId, receiverUser.id));

  const [result] = where ? await query.where(where) : await query;
  return result?.count ?? 0;
}

/**
 * Fetches all transfers matching the filters with no pagination limit.
 *
 * Called by `listAllTypes` in the main service, which merges all three
 * transaction types, sorts them by `createdAt` descending, and then applies
 * pagination in memory.
 *
 * @param db      - Drizzle database instance.
 * @param filters - Active filter values.
 * @returns Array of normalised `AdminTransactionItem` rows (type = "transfer").
 */
export async function fetchTransfers(
  db: Database,
  filters: ListFilters
): Promise<AdminTransactionItem[]> {
  const senderUser = alias(users, "sender_user");
  const receiverUser = alias(users, "receiver_user");
  const where = buildTransferWhere(filters, senderUser, receiverUser);

  const base = db
    .select({
      publicId: transfers.publicId,
      amountCents: transfers.netAmountCents,
      feeCents: transfers.feeCents,
      status: transactionStatuses.name,
      createdAt: transfers.createdAt,
      completedAt: transfers.completedAt,
      userPublicId: senderUser.publicId,
      userName: senderUser.name,
      userEmail: senderUser.email,
      counterpartyPublicId: receiverUser.publicId,
      counterpartyName: receiverUser.name,
      blockchainTxHash: blockchainTransactions.txHash,
    })
    .from(transfers)
    .innerJoin(senderUser, eq(transfers.senderUserId, senderUser.id))
    .leftJoin(receiverUser, eq(transfers.receiverUserId, receiverUser.id))
    .innerJoin(
      transactionStatuses,
      eq(transfers.statusId, transactionStatuses.id)
    )
    .leftJoin(
      blockchainTransactions,
      eq(transfers.blockchainTxId, blockchainTransactions.id)
    )
    .orderBy(desc(transfers.createdAt));

  const rows = where ? await base.where(where) : await base;

  return compact(
    rows.map((row) => {
      const status = validateStatus(row.status);
      if (!status) {
        return null;
      }
      return {
        publicId: row.publicId,
        type: "transfer" as const,
        amountCents: toCents(row.amountCents),
        feeCents: toCents(row.feeCents),
        status,
        createdAt: row.createdAt,
        completedAt: row.completedAt,
        userPublicId: row.userPublicId,
        userName: row.userName,
        userEmail: row.userEmail,
        counterpartyPublicId: row.counterpartyPublicId,
        counterpartyName: row.counterpartyName,
        blockchainTxHash: row.blockchainTxHash,
      } satisfies AdminTransactionItem;
    })
  );
}

/**
 * Returns a paginated list of transfers along with the total matching count.
 *
 * Used when the caller explicitly filters by `type = "transfer"`, allowing
 * the DB to apply LIMIT/OFFSET directly instead of in-memory slicing.
 *
 * @param db      - Drizzle database instance.
 * @param filters - Active filter values.
 * @param limit   - Maximum number of rows to return.
 * @param offset  - Number of rows to skip (for pagination).
 * @returns `Ok(ListResult)` on success or `InternalError` on DB failure.
 */
export function queryTransfers(
  db: Database,
  filters: ListFilters,
  limit: number,
  offset: number
): ResultAsync<ListResult, InternalError> {
  const senderUser = alias(users, "sender_user");
  const receiverUser = alias(users, "receiver_user");
  const where = buildTransferWhere(filters, senderUser, receiverUser);

  const base = db
    .select({
      publicId: transfers.publicId,
      amountCents: transfers.netAmountCents,
      feeCents: transfers.feeCents,
      status: transactionStatuses.name,
      createdAt: transfers.createdAt,
      completedAt: transfers.completedAt,
      userPublicId: senderUser.publicId,
      userName: senderUser.name,
      userEmail: senderUser.email,
      counterpartyPublicId: receiverUser.publicId,
      counterpartyName: receiverUser.name,
      blockchainTxHash: blockchainTransactions.txHash,
    })
    .from(transfers)
    .innerJoin(senderUser, eq(transfers.senderUserId, senderUser.id))
    .leftJoin(receiverUser, eq(transfers.receiverUserId, receiverUser.id))
    .innerJoin(
      transactionStatuses,
      eq(transfers.statusId, transactionStatuses.id)
    )
    .leftJoin(
      blockchainTransactions,
      eq(transfers.blockchainTxId, blockchainTransactions.id)
    )
    .orderBy(desc(transfers.createdAt))
    .limit(limit)
    .offset(offset);

  return ResultAsync.fromPromise(
    Promise.all([
      countTransfers(db, filters),
      where ? base.where(where) : base,
    ]),
    (e): InternalError =>
      new InternalError("Failed to fetch transfer list", { cause: e })
  ).map(([total, rows]) => ({
    items: compact(
      rows.map((row) => {
        const status = validateStatus(row.status);
        if (!status) {
          return null;
        }
        return {
          publicId: row.publicId,
          type: "transfer" as const,
          amountCents: toCents(row.amountCents),
          feeCents: toCents(row.feeCents),
          status,
          createdAt: row.createdAt,
          completedAt: row.completedAt,
          userPublicId: row.userPublicId,
          userName: row.userName,
          userEmail: row.userEmail,
          counterpartyPublicId: row.counterpartyPublicId,
          counterpartyName: row.counterpartyName,
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
 * Fetches a single transfer by its public ID.
 *
 * @param db       - Drizzle database instance.
 * @param publicId - The transfer's UUID public identifier.
 * @returns The matching `AdminTransactionItem`, or `null` if not found.
 */
export async function findTransfer(
  db: Database,
  publicId: string
): Promise<AdminTransactionItem | null> {
  const senderUser = alias(users, "sender_user");
  const receiverUser = alias(users, "receiver_user");

  const [row] = await db
    .select({
      publicId: transfers.publicId,
      amountCents: transfers.netAmountCents,
      feeCents: transfers.feeCents,
      status: transactionStatuses.name,
      createdAt: transfers.createdAt,
      completedAt: transfers.completedAt,
      userPublicId: senderUser.publicId,
      userName: senderUser.name,
      userEmail: senderUser.email,
      counterpartyPublicId: receiverUser.publicId,
      counterpartyName: receiverUser.name,
      blockchainTxHash: blockchainTransactions.txHash,
    })
    .from(transfers)
    .innerJoin(senderUser, eq(transfers.senderUserId, senderUser.id))
    .leftJoin(receiverUser, eq(transfers.receiverUserId, receiverUser.id))
    .innerJoin(
      transactionStatuses,
      eq(transfers.statusId, transactionStatuses.id)
    )
    .leftJoin(
      blockchainTransactions,
      eq(transfers.blockchainTxId, blockchainTransactions.id)
    )
    .where(eq(transfers.publicId, publicId));

  if (!row) {
    return null;
  }

  const status = validateStatus(row.status);
  if (!status) {
    return null;
  }

  return {
    publicId: row.publicId,
    type: "transfer",
    amountCents: toCents(row.amountCents),
    feeCents: toCents(row.feeCents),
    status,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    userPublicId: row.userPublicId,
    userName: row.userName,
    userEmail: row.userEmail,
    counterpartyPublicId: row.counterpartyPublicId,
    counterpartyName: row.counterpartyName,
    blockchainTxHash: row.blockchainTxHash,
  };
}
