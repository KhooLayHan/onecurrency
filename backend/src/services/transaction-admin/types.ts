/**
 * Shared types for the admin transaction query layer.
 *
 * These types are used across all three query modules (deposit, withdrawal,
 * transfer) and by the orchestrating `TransactionAdminService`.
 */
import type { alias } from "drizzle-orm/pg-core";
import type { users } from "../../db/schema/users";

/** A single normalised row returned by the admin transaction list/detail endpoints. */
export type AdminTransactionItem = {
  publicId: string;
  type: "add_money" | "cash_out" | "transfer";
  amountCents: number;
  feeCents: number;
  status: "pending" | "processing" | "completed" | "failed" | "refunded";
  createdAt: Date;
  completedAt: Date | null;
  userPublicId: string;
  userName: string;
  userEmail: string;
  counterpartyPublicId: string | null;
  counterpartyName: string | null;
  blockchainTxHash: string | null;
};

/** Filter options accepted by the list endpoint. */
export type ListFilters = {
  type?: "add_money" | "cash_out" | "transfer";
  statusId?: number;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  page: number;
  pageSize: number;
};

/** Paginated response shape returned by the list endpoint. */
export type ListResult = {
  items: AdminTransactionItem[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Alias type for a Drizzle table alias of `users`.
 * Used specifically in the transfer queries that need two user joins
 * (sender + receiver).
 */
export type UserAlias = ReturnType<typeof alias<typeof users, string>>;

// ─── Shared validation constants ───────────────────────────────────────────

const VALID_STATUSES = new Set([
  "pending",
  "processing",
  "completed",
  "failed",
  "refunded",
]);

/**
 * Validates a raw status string from the DB against the known set of statuses.
 * Returns `null` if the value is unrecognised (rows with unknown statuses are
 * filtered out rather than thrown on).
 */
export function validateStatus(
  raw: string
): AdminTransactionItem["status"] | null {
  const s = raw.toLowerCase();
  if (VALID_STATUSES.has(s)) {
    return s as AdminTransactionItem["status"];
  }
  return null;
}

/** Converts a nullable bigint column value to a JS number (cents). */
export function toCents(value: bigint | null): number {
  return Number(value ?? 0n);
}

/** Removes `null` entries from an array with a type-safe predicate. */
export function compact<T>(arr: (T | null)[]): T[] {
  return arr.filter((x): x is T => x !== null);
}
