/**
 * Metrics repository.
 *
 * Aggregates platform-wide statistics from across multiple domain tables
 * (users, KYC submissions, deposits, withdrawals, transfers) in a single
 * parallel query batch. Used exclusively by the admin metrics dashboard.
 */
import { and, count, eq, gte, isNotNull, sum } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { InternalError } from "@/common/errors/infrastructure";
import { KYC_STATUS } from "../constants/kyc-status";
import { TRANSACTION_STATUS } from "../constants/transaction-status";
import type { Database } from "../db";
import { deposits } from "../db/schema/deposits";
import { kycSubmissions } from "../db/schema/kyc-submissions";
import { transfers } from "../db/schema/transfers";
import { users } from "../db/schema/users";
import { withdrawals } from "../db/schema/withdrawals";

/** Input date boundaries for the rolling-window metrics queries. */
type MetricsSummaryInput = {
  /** Lower bound for the "new users in last N days" query. */
  thirtyDaysAgo: Date;
  /** Lower bound for the "failed transactions in last N days" query. */
  sevenDaysAgo: Date;
};

/** Aggregated platform metrics returned by `getSummary`. */
export type MetricsSummaryData = {
  totalUsers: number;
  newUsersLast30Days: number;
  suspendedUsers: number;
  /** Raw user counts keyed by KYC status ID. Callers map to named fields. */
  kycByStatusId: Record<number, number>;
  pendingKycSubmissions: number;
  depositsVolume: { count: number; totalAmountCents: number };
  withdrawalsVolume: { count: number; totalAmountCents: number };
  transfersVolume: { count: number; totalAmountCents: number };
  failedDepositsLast7Days: number;
  failedWithdrawalsLast7Days: number;
  failedTransfersLast7Days: number;
};

type VolumeRow = { count: number; totalAmountCents: string | null | undefined };

/** Converts a volume aggregate row to a normalised `{ count, totalAmountCents }` object. */
function toVolume(rows: VolumeRow[]): {
  count: number;
  totalAmountCents: number;
} {
  return {
    count: rows[0]?.count ?? 0,
    totalAmountCents: Number(rows[0]?.totalAmountCents ?? 0),
  };
}

export class MetricsRepository {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  /**
   * Executes all 11 platform metrics queries in parallel and returns fully
   * aggregated results.
   *
   * Queries span users, KYC submissions, deposits, withdrawals, and transfers.
   * All results are live — no caching is applied at this layer.
   *
   * @param input - Rolling-window date boundaries for time-scoped queries.
   * @returns Aggregated `MetricsSummaryData`.
   */
  getSummary(
    input: MetricsSummaryInput
  ): ResultAsync<MetricsSummaryData, InternalError> {
    return ResultAsync.fromPromise(
      (async () => {
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
        ] = await Promise.all([
          // 0: total registered users
          this.db
            .select({ count: count() })
            .from(users),
          // 1: new users in last 30 days
          this.db
            .select({ count: count() })
            .from(users)
            .where(gte(users.createdAt, input.thirtyDaysAgo)),
          // 2: suspended users (soft-deleted)
          this.db
            .select({ count: count() })
            .from(users)
            .where(isNotNull(users.deletedAt)),
          // 3: user counts grouped by KYC status ID
          this.db
            .select({ kycStatusId: users.kycStatusId, count: count() })
            .from(users)
            .groupBy(users.kycStatusId),
          // 4: unreviewed KYC submissions
          this.db
            .select({ count: count() })
            .from(kycSubmissions)
            .where(eq(kycSubmissions.kycStatusId, KYC_STATUS.PENDING)),
          // 5: completed deposit count + volume
          this.db
            .select({
              count: count(),
              totalAmountCents: sum(deposits.amountCents),
            })
            .from(deposits)
            .where(eq(deposits.statusId, TRANSACTION_STATUS.COMPLETED)),
          // 6: completed withdrawal count + volume
          this.db
            .select({
              count: count(),
              totalAmountCents: sum(withdrawals.fiatAmountCents),
            })
            .from(withdrawals)
            .where(eq(withdrawals.statusId, TRANSACTION_STATUS.COMPLETED)),
          // 7: completed transfer count + volume
          this.db
            .select({
              count: count(),
              totalAmountCents: sum(transfers.amountCents),
            })
            .from(transfers)
            .where(eq(transfers.statusId, TRANSACTION_STATUS.COMPLETED)),
          // 8: failed deposits in last 7 days
          this.db
            .select({ count: count() })
            .from(deposits)
            .where(
              and(
                eq(deposits.statusId, TRANSACTION_STATUS.FAILED),
                gte(deposits.createdAt, input.sevenDaysAgo)
              )
            ),
          // 9: failed withdrawals in last 7 days
          this.db
            .select({ count: count() })
            .from(withdrawals)
            .where(
              and(
                eq(withdrawals.statusId, TRANSACTION_STATUS.FAILED),
                gte(withdrawals.createdAt, input.sevenDaysAgo)
              )
            ),
          // 10: failed transfers in last 7 days
          this.db
            .select({ count: count() })
            .from(transfers)
            .where(
              and(
                eq(transfers.statusId, TRANSACTION_STATUS.FAILED),
                gte(transfers.createdAt, input.sevenDaysAgo)
              )
            ),
        ]);

        const kycByStatusId: Record<number, number> = {};
        for (const row of kycCountRows) {
          kycByStatusId[row.kycStatusId] = row.count;
        }

        return {
          totalUsers: totalUsersRows[0]?.count ?? 0,
          newUsersLast30Days: newUsersRows[0]?.count ?? 0,
          suspendedUsers: suspendedRows[0]?.count ?? 0,
          kycByStatusId,
          pendingKycSubmissions: pendingKycRows[0]?.count ?? 0,
          depositsVolume: toVolume(depositsVolumeRows),
          withdrawalsVolume: toVolume(withdrawalsVolumeRows),
          transfersVolume: toVolume(transfersVolumeRows),
          failedDepositsLast7Days: failedDepositsRows[0]?.count ?? 0,
          failedWithdrawalsLast7Days: failedWithdrawalsRows[0]?.count ?? 0,
          failedTransfersLast7Days: failedTransfersRows[0]?.count ?? 0,
        };
      })(),
      (e): InternalError =>
        new InternalError("Failed to fetch platform metrics", { cause: e })
    );
  }
}
