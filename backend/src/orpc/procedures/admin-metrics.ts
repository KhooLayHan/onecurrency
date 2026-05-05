/**
 * Admin metrics procedure.
 *
 * Returns aggregated platform statistics for the admin dashboard home:
 * user growth, KYC funnel, transaction volume, and failure signal.
 * All queries run in parallel inside `MetricsRepository`. Requires admin
 * or compliance role.
 */
import z from "zod";
import { KYC_STATUS } from "@/src/constants/kyc-status";
import { db } from "@/src/db";
import { MetricsRepository } from "@/src/repositories/metrics.repository";
import { base } from "../context";
import { mapToORPCError } from "../errors";
import { requireRole } from "../middleware";

const metricsRepository = new MetricsRepository(db);

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

    const result = await metricsRepository.getSummary({
      thirtyDaysAgo,
      sevenDaysAgo,
    });
    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }

    const data = result.value;

    return {
      totalUsers: data.totalUsers,
      newUsersLast30Days: data.newUsersLast30Days,
      suspendedUsers: data.suspendedUsers,
      kycCounts: {
        none: data.kycByStatusId[KYC_STATUS.NONE] ?? 0,
        pending: data.kycByStatusId[KYC_STATUS.PENDING] ?? 0,
        verified: data.kycByStatusId[KYC_STATUS.VERIFIED] ?? 0,
        rejected: data.kycByStatusId[KYC_STATUS.REJECTED] ?? 0,
        expired: data.kycByStatusId[KYC_STATUS.EXPIRED] ?? 0,
      },
      pendingKycSubmissions: data.pendingKycSubmissions,
      transactionVolume: {
        deposits: data.depositsVolume,
        withdrawals: data.withdrawalsVolume,
        transfers: data.transfersVolume,
      },
      failedTransactionsLast7Days:
        data.failedDepositsLast7Days +
        data.failedWithdrawalsLast7Days +
        data.failedTransfersLast7Days,
    };
  });
