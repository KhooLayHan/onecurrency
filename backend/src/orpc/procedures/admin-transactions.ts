/**
 * Admin transaction procedures.
 *
 * Exposes two oRPC procedures for the admin transaction management UI:
 *
 * - `listAdminTransactions` — paginated, filterable list across all three
 *   transaction types (deposits, withdrawals, transfers).
 * - `getAdminTransaction`   — full detail for a single transaction looked up
 *   by its public UUID.
 *
 * Both procedures require the appropriate `transaction:*` permission enforced
 * by the `requirePermission` middleware.
 */
import { ORPCError } from "@orpc/server";
import z from "zod";
import { db } from "@/src/db";
import { TransactionAdminService } from "@/src/services/transaction-admin";
import { base } from "../context";
import { mapToORPCError } from "../errors";
import { requirePermission } from "../middleware";

const service = new TransactionAdminService(db);

/** Default page size for the admin transaction list. */
const ADMIN_TRANSACTION_PAGE_SIZE = 20;

/**
 * Zod schema for a single normalised transaction row returned by both
 * `listAdminTransactions` and `getAdminTransaction`.
 */
const adminTransactionItemSchema = z.object({
  publicId: z.string(),
  type: z.enum(["add_money", "cash_out", "transfer"]),
  amountCents: z.number(),
  feeCents: z.number(),
  status: z.enum(["pending", "processing", "completed", "failed", "refunded"]),
  createdAt: z.date(),
  completedAt: z.date().nullable(),
  userPublicId: z.string(),
  userName: z.string(),
  userEmail: z.string(),
  counterpartyPublicId: z.string().nullable(),
  counterpartyName: z.string().nullable(),
  blockchainTxHash: z.string().nullable(),
});

/**
 * Parses a date string for the `dateFrom` filter.
 *
 * Accepts any string that `new Date()` can parse (ISO-8601 recommended).
 * Returns `undefined` when the input is absent so the filter is omitted.
 *
 * @param value - Raw date string from the API input, or `undefined`.
 * @returns A `Date` object, or `undefined` if no value was supplied.
 * @throws `ORPCError("BAD_REQUEST")` when the string is not a valid date.
 */
function parseDateFilter(value: string | undefined): Date | undefined {
  if (!value) {
    return;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new ORPCError("BAD_REQUEST", {
      message: `Invalid date filter: "${value}"`,
    });
  }
  return d;
}

/** Regex that matches a bare `YYYY-MM-DD` date string (no time component). */
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const END_OF_DAY_HOUR = 23;
const END_OF_DAY_MINUTE = 59;
const END_OF_DAY_SECOND = 59;
const END_OF_DAY_MS = 999;

/**
 * Parses a date string for the `dateTo` filter and advances bare date strings
 * to the end of that calendar day in UTC so the filter is inclusive.
 *
 * For example, `"2024-01-15"` becomes `2024-01-15T23:59:59.999Z` so all
 * transactions created on that day are included.
 *
 * @param value - Raw date string from the API input, or `undefined`.
 * @returns A `Date` set to end-of-day when a date-only string is given,
 *          the parsed `Date` as-is for datetime strings, or `undefined` when absent.
 * @throws `ORPCError("BAD_REQUEST")` when the string is not a valid date.
 */
function parseDateToFilter(value: string | undefined): Date | undefined {
  if (!value) {
    return;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new ORPCError("BAD_REQUEST", {
      message: `Invalid date filter: "${value}"`,
    });
  }
  if (DATE_ONLY_RE.test(value)) {
    d.setUTCHours(
      END_OF_DAY_HOUR,
      END_OF_DAY_MINUTE,
      END_OF_DAY_SECOND,
      END_OF_DAY_MS
    );
  }
  return d;
}

/**
 * Returns a paginated list of transactions across deposits, withdrawals, and
 * transfers, with optional filtering by type, status, date range, and text.
 *
 * When no `type` filter is given, all three tables are queried in parallel,
 * merged, and sorted by `createdAt` descending before pagination is applied.
 * When a `type` is specified, pagination is applied at the DB level.
 *
 * @permission transaction:list
 * @input  page     - 1-based page number (default 1).
 * @input  type     - Optional transaction type to filter by.
 * @input  statusId - Optional DB status ID to filter by.
 * @input  dateFrom - Optional ISO date string for the lower bound of `createdAt`.
 * @input  dateTo   - Optional ISO date string for the upper bound of `createdAt`.
 * @input  search   - Optional text search across user name and email.
 * @output Paginated list of `adminTransactionItemSchema` rows.
 */
export const listAdminTransactions = base
  .use(requirePermission("transaction:list"))
  .input(
    z.object({
      page: z.number().int().min(1).default(1),
      type: z.enum(["add_money", "cash_out", "transfer"]).optional(),
      statusId: z.number().int().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      search: z.string().trim().optional(),
    })
  )
  .output(
    z.object({
      items: z.array(adminTransactionItemSchema),
      total: z.number(),
      page: z.number(),
      pageSize: z.number(),
    })
  )
  .handler(async ({ input }) => {
    const result = await service.list({
      page: input.page,
      pageSize: ADMIN_TRANSACTION_PAGE_SIZE,
      type: input.type,
      statusId: input.statusId,
      dateFrom: parseDateFilter(input.dateFrom),
      dateTo: parseDateToFilter(input.dateTo),
      search: input.search,
    });

    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }

    return result.value;
  });

/**
 * Returns the full detail of a single transaction by its public UUID.
 *
 * Searches deposits, withdrawals, and transfers in parallel. Returns a 404
 * when the public ID does not match any transaction in any table.
 *
 * @permission transaction:read
 * @input  publicId - UUID of the transaction to retrieve.
 * @output Single `adminTransactionItemSchema` row.
 */
export const getAdminTransaction = base
  .use(requirePermission("transaction:read"))
  .input(z.object({ publicId: z.uuid() }))
  .output(adminTransactionItemSchema)
  .handler(async ({ input }) => {
    const result = await service.get(input.publicId);

    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }

    return result.value;
  });
