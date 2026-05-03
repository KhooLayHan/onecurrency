/**
 * Admin transaction service — public API.
 *
 * `TransactionAdminService` is the single entry point for the admin transaction
 * list and detail endpoints. It delegates all actual DB querying to the three
 * type-specific modules so each module stays focused on one concern:
 *
 * - `deposit-query.ts`    — "add money" transactions
 * - `withdrawal-query.ts` — "cash out" transactions
 * - `transfer-query.ts`   — peer-to-peer transfers
 *
 * Shared types and small row-mapping utilities live in `types.ts`.
 *
 * The original import path (`@/src/services/transaction-admin.service`) still
 * resolves here because Bun/Node resolve directory imports through `index.ts`,
 * so no callers need to change their import statements.
 */
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { InternalError } from "@/common/errors/infrastructure";
import type { Database } from "../../db";
import {
  countDeposits,
  fetchDeposits,
  findDeposit,
  queryDeposits,
} from "./deposit-query";
import {
  countTransfers,
  fetchTransfers,
  findTransfer,
  queryTransfers,
} from "./transfer-query";
import type { AdminTransactionItem, ListFilters, ListResult } from "./types";
import {
  countWithdrawals,
  fetchWithdrawals,
  findWithdrawal,
  queryWithdrawals,
} from "./withdrawal-query";

/** Default page size when the caller omits `pageSize` from the request. */
const ADMIN_TRANSACTION_PAGE_SIZE = 20;

/**
 * Orchestrates admin-facing transaction queries across deposits, withdrawals,
 * and transfers.
 *
 * Designed as a thin coordinator: it decides which query module(s) to invoke
 * based on the provided filters and delegates all SQL to the sub-modules.
 */
export class TransactionAdminService {
  private readonly db: Database;

  /**
   * @param database - Drizzle database instance injected at construction time.
   */
  constructor(database: Database) {
    this.db = database;
  }

  /**
   * Returns a paginated list of transactions, optionally filtered by type,
   * status, date range, or a text search term.
   *
   * When `filters.type` is set, the query is delegated to the matching
   * type-specific module and the DB handles LIMIT/OFFSET directly.
   *
   * When no type filter is provided, all three tables are queried in parallel,
   * the results are merged and sorted by `createdAt` descending, and
   * pagination is applied in memory.
   *
   * @param filters - Filter and pagination options for the query.
   * @returns `Ok(ListResult)` on success or `InternalError` on DB failure.
   */
  list(filters: ListFilters): ResultAsync<ListResult, InternalError> {
    const pageSize = filters.pageSize || ADMIN_TRANSACTION_PAGE_SIZE;

    if (filters.type) {
      return this.listSingleType({ ...filters, pageSize, type: filters.type });
    }

    return this.listAllTypes({ ...filters, pageSize });
  }

  /**
   * Fetches a single transaction by its public ID.
   *
   * Searches deposits, withdrawals, and transfers in parallel and returns
   * whichever table has a matching row. Returns an `InternalError` if the
   * public ID does not exist in any table.
   *
   * @param publicId - The transaction's UUID public identifier.
   * @returns `Ok(AdminTransactionItem)` on success, or `InternalError` if not found.
   */
  get(publicId: string): ResultAsync<AdminTransactionItem, InternalError> {
    return ResultAsync.fromPromise(
      Promise.all([
        findDeposit(this.db, publicId),
        findWithdrawal(this.db, publicId),
        findTransfer(this.db, publicId),
      ]),
      (e): InternalError =>
        new InternalError("Failed to fetch transaction details", {
          cause: e,
          context: { publicId },
        })
    ).andThen(([deposit, withdrawal, transfer]) => {
      const found = deposit ?? withdrawal ?? transfer;
      if (!found) {
        return errAsync(
          new InternalError("Transaction not found", { context: { publicId } })
        );
      }
      return okAsync(found);
    });
  }

  /**
   * Delegates to the appropriate single-type query module when `filters.type`
   * is set, enabling DB-level pagination.
   *
   * @param filters - Filters with a required `type` field.
   */
  private listSingleType(
    filters: ListFilters & { type: "add_money" | "cash_out" | "transfer" }
  ): ResultAsync<ListResult, InternalError> {
    const { pageSize, type } = filters;
    const offset = (filters.page - 1) * pageSize;

    if (type === "add_money") {
      return queryDeposits(this.db, filters, pageSize, offset);
    }
    if (type === "cash_out") {
      return queryWithdrawals(this.db, filters, pageSize, offset);
    }
    return queryTransfers(this.db, filters, pageSize, offset);
  }

  /**
   * Fetches all three transaction types in parallel, merges the results,
   * sorts them by `createdAt` descending, and applies in-memory pagination.
   *
   * Used when no `type` filter is active (the "All" tab in the admin UI).
   *
   * @param filters - Filter and pagination options (without a type constraint).
   */
  private listAllTypes(
    filters: ListFilters
  ): ResultAsync<ListResult, InternalError> {
    const pageSize = filters.pageSize;

    return ResultAsync.fromPromise(
      Promise.all([
        countDeposits(this.db, filters),
        countWithdrawals(this.db, filters),
        countTransfers(this.db, filters),
        fetchDeposits(this.db, filters),
        fetchWithdrawals(this.db, filters),
        fetchTransfers(this.db, filters),
      ]),
      (e): InternalError =>
        new InternalError("Failed to fetch unified transaction list", {
          cause: e,
        })
    ).map(
      ([
        depositCount,
        withdrawalCount,
        transferCount,
        depositRows,
        withdrawalRows,
        transferRows,
      ]) => {
        const total = depositCount + withdrawalCount + transferCount;
        const all = [...depositRows, ...withdrawalRows, ...transferRows].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );
        const start = (filters.page - 1) * pageSize;
        const items = all.slice(start, start + pageSize);
        return { items, total, page: filters.page, pageSize };
      }
    );
  }
}

// Re-export shared types so callers that import from this module
// can access them without reaching into the internal sub-modules.
export type { AdminTransactionItem, ListFilters, ListResult } from "./types";
