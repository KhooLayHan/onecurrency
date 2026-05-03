/**
 * Admin metrics procedure.
 *
 * Returns aggregated platform statistics for the admin dashboard home:
 * user growth, KYC funnel, transaction volume, and failure signal.
 * All queries run in parallel. Requires admin or compliance role.
 */
import { and, count, eq, gte, isNotNull, sum } from "drizzle-orm";
import z from "zod";
import { KYC_STATUS } from "@/src/constants/kyc-status";
import { TRANSACTION_STATUS } from "@/src/constants/transaction-status";
import { db } from "@/src/db";
import { deposits } from "@/src/db/schema/deposits";
import { kycSubmissions } from "@/src/db/schema/kyc-submissions";
import { transfers } from "@/src/db/schema/transfers";
import { users } from "@/src/db/schema/users";
import { withdrawals } from "@/src/db/schema/withdrawals";
import { base } from "../context";
import { requireRole } from "../middleware";

/** Rolling window for "new users" metric (days). */
const NEW_USERS_WINDOW_DAYS = 30;

/** Rolling window for "failed transactions" metric (days). */
const FAILED_TX_WINDOW_DAYS = 7;

/** Milliseconds in one day. */
const MS_PER_DAY = 86_400_000;

const txVolumeSchema = z.object({
  count: z.number(),
  totalAmountCents: z.number(),
});

/**
 * Runs all metrics DB queries in parallel and returns raw result arrays.
 * Extracted to keep the handler's cognitive complexity below the limit.
 */
function runMetricsQueries(thirtyDaysAgo: Date, sevenDaysAgo: Date) {
  return Promise.all([
    // 0: total registered users
    db
      .select({ count: count() })
      .from(users),
    // 1: new users in last 30 days
    db
      .select({ count: count() })
      .from(users)
      .where(gte(users.createdAt, thirtyDaysAgo)),
    // 2: suspended users (soft-deleted)
    db
      .select({ count: count() })
      .from(users)
      .where(isNotNull(users.deletedAt)),
    // 3: user counts grouped by KYC status ID
    db
      .select({ kycStatusId: users.kycStatusId, count: count() })
      .from(users)
      .groupBy(users.kycStatusId),
    // 4: unreviewed KYC submissions
    db
      .select({ count: count() })
      .from(kycSubmissions)
      .where(eq(kycSubmissions.kycStatusId, KYC_STATUS.PENDING)),
    // 5: completed deposit count + volume
    db
      .select({ count: count(), totalAmountCents: sum(deposits.amountCents) })
      .from(deposits)
      .where(eq(deposits.statusId, TRANSACTION_STATUS.COMPLETED)),
    // 6: completed withdrawal count + volume
    db
      .select({
        count: count(),
        totalAmountCents: sum(withdrawals.fiatAmountCents),
      })
      .from(withdrawals)
      .where(eq(withdrawals.statusId, TRANSACTION_STATUS.COMPLETED)),
    // 7: completed transfer count + volume
    db
      .select({ count: count(), totalAmountCents: sum(transfers.amountCents) })
      .from(transfers)
      .where(eq(transfers.statusId, TRANSACTION_STATUS.COMPLETED)),
    // 8: failed deposits in last 7 days
    db
      .select({ count: count() })
      .from(deposits)
      .where(
        and(
          eq(deposits.statusId, TRANSACTION_STATUS.FAILED),
          gte(deposits.createdAt, sevenDaysAgo)
        )
      ),
    // 9: failed withdrawals in last 7 days
    db
      .select({ count: count() })
      .from(withdrawals)
      .where(
        and(
          eq(withdrawals.statusId, TRANSACTION_STATUS.FAILED),
          gte(withdrawals.createdAt, sevenDaysAgo)
        )
      ),
    // 10: failed transfers in last 7 days
    db
      .select({ count: count() })
      .from(transfers)
      .where(
        and(
          eq(transfers.statusId, TRANSACTION_STATUS.FAILED),
          gte(transfers.createdAt, sevenDaysAgo)
        )
      ),
  ]);
}

type KycCountRow = { kycStatusId: number; count: number };

/** Builds a statusId → count lookup map from the grouped KYC query result. */
function buildKycByStatus(rows: KycCountRow[]): Record<number, number> {
  const map: Record<number, number> = {};
  for (const row of rows) {
    map[row.kycStatusId] = row.count;
  }
  return map;
}

/** Returns the count from the first row of a count query, or 0. */
function firstCount(rows: Array<{ count: number }>): number {
  return rows[0]?.count ?? 0;
}
type VolumeRow = { count: number; totalAmountCents: string | null | undefined };
/** Converts a volume query row to { count, totalAmountCents }. */
function toVolume(rows: VolumeRow[]): {
  count: number;
  totalAmountCents: number;
} {
  return {
    count: rows[0]?.count ?? 0,
    totalAmountCents: Number(rows[0]?.totalAmountCents ?? 0),
  };
}

/**
 * Returns aggregated platform metrics for the admin dashboard home.
 *
 * @role admin | compliance
 * @output Aggregated metrics snapshot (not cached — always live).
 */
export const getAdminMetricsSummary = base
  .use(requireRole("admin", "compliance"))
  .input(z.object({}))
  .output(
    z.object({
      totalUsers: z.number(),
      newUsersLast30Days: z.number(),
      suspendedUsers: z.number(),
      kycCounts: z.object({
        none: z.number(),
        pending: z.number(),
        verified: z.number(),
        rejected: z.number(),
        expired: z.number(),
      }),
      pendingKycSubmissions: z.number(),
      transactionVolume: z.object({
        deposits: txVolumeSchema,
        withdrawals: txVolumeSchema,
        transfers: txVolumeSchema,
      }),
      failedTransactionsLast7Days: z.number(),
    })
  )
  .handler(async () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(
      now.getTime() - NEW_USERS_WINDOW_DAYS * MS_PER_DAY
    );
    const sevenDaysAgo = new Date(
      now.getTime() - FAILED_TX_WINDOW_DAYS * MS_PER_DAY
    );

    const [
      totalUsersRows,
      newUsersRows,
      suspendedRows,
      kycCountRows,
      pendingKycRows,
      depositsVolumeRows,
      withdrawalsVolumeRows,
      transfersVolumeRows,
      failedDepositsRows,
      failedWithdrawalsRows,
      failedTransfersRows,
    ] = await runMetricsQueries(thirtyDaysAgo, sevenDaysAgo);

    const kycByStatus = buildKycByStatus(kycCountRows);

    return {
      totalUsers: firstCount(totalUsersRows),
      newUsersLast30Days: firstCount(newUsersRows),
      suspendedUsers: firstCount(suspendedRows),
      kycCounts: {
        none: kycByStatus[KYC_STATUS.NONE] ?? 0,
        pending: kycByStatus[KYC_STATUS.PENDING] ?? 0,
        verified: kycByStatus[KYC_STATUS.VERIFIED] ?? 0,
        rejected: kycByStatus[KYC_STATUS.REJECTED] ?? 0,
        expired: kycByStatus[KYC_STATUS.EXPIRED] ?? 0,
      },
      pendingKycSubmissions: firstCount(pendingKycRows),
      transactionVolume: {
        deposits: toVolume(depositsVolumeRows),
        withdrawals: toVolume(withdrawalsVolumeRows),
        transfers: toVolume(transfersVolumeRows),
      },
      failedTransactionsLast7Days:
        firstCount(failedDepositsRows) +
        firstCount(failedWithdrawalsRows) +
        firstCount(failedTransfersRows),
    };
  });
