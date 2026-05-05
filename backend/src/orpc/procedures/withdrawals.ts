/**
 * Withdrawal procedures.
 *
 * Handles user-facing cash-out (money-out) flows:
 *
 * - `initiate`    — burns the user's on-chain tokens and triggers a Stripe payout
 *                   to their linked bank account.
 * - `getHistory`  — returns the authenticated user's withdrawal history.
 *
 * Both procedures require an authenticated session via `requireAuth`.
 */
import { ORPCError } from "@orpc/server";
import z from "zod";
import { db } from "@/src/db";
import { initiateWithdrawalSchema } from "@/src/dto/withdrawal.dto";
import { logger } from "@/src/lib/logger";
import { WithdrawalRepository } from "@/src/repositories/withdrawal.repository";
import { WithdrawalService } from "@/src/services/withdrawal.service";
import { base } from "../context";
import { mapToORPCError } from "../errors";
import { requireAuth } from "../middleware";

const withdrawalService = new WithdrawalService(db);
const withdrawalRepository = new WithdrawalRepository(db);

/**
 * Output schema for a single row in the withdrawal history list.
 */
const withdrawalHistoryItemSchema = z.object({
  id: z.string(),
  publicId: z.string(),
  type: z.literal("cash_out"),
  amountCents: z.number(),
  status: z.enum(["pending", "processing", "completed", "failed", "refunded"]),
  createdAt: z.date(),
});

/**
 * Initiates a cash-out by burning the user's on-chain tokens and triggering
 * a Stripe payout to their linked bank account.
 *
 * The response status reflects the initial state of the payout:
 * `"processing"` means the Stripe payout was queued; `"completed"` means it
 * settled synchronously (rare, typically only in test mode).
 *
 * @auth   requireAuth
 * @input  initiateWithdrawalSchema fields (amount, bank account details, etc.)
 * @output withdrawalId - The public UUID of the new withdrawal record.
 * @output status       - Initial payout status (`"processing"` | `"completed"`).
 */
export const initiate = base
  .use(requireAuth)
  .route({
    method: "POST",
    path: "/withdrawals/initiate",
    summary: "Initiate a cash-out to bank (burn tokens → Stripe payout)",
    tags: ["Withdrawals"],
  })
  .input(initiateWithdrawalSchema)
  .output(
    z.object({
      withdrawalId: z.string(),
      status: z.enum(["processing", "completed"]),
    })
  )
  .handler(async ({ input, context }) => {
    const userId = context.session?.userId;
    if (!userId) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "Authentication required",
      });
    }

    logger.info({ userId }, "Processing cash-out request");

    const result = await withdrawalService.initiateWithdrawal(
      BigInt(userId),
      input
    );
    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }
    return result.value;
  });

/**
 * Returns the authenticated user's full withdrawal history, ordered by most
 * recent first.
 *
 * @auth   requireAuth
 * @output Array of `withdrawalHistoryItemSchema` rows.
 */
export const getHistory = base
  .use(requireAuth)
  .route({
    method: "GET",
    path: "/withdrawals/history",
    summary: "Get cash-out history for the authenticated user",
    tags: ["Withdrawals"],
  })
  .output(z.array(withdrawalHistoryItemSchema))
  .handler(async ({ context }) => {
    const userId = context.session?.userId;
    if (!userId) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "Authentication required",
      });
    }

    logger.info({ userId }, "Fetching withdrawal history");

    const result = await withdrawalRepository.findByUserId(BigInt(userId));
    if (result.isErr()) {
      logger.error(
        { error: result.error.toLog() },
        "Withdrawal history query failed"
      );
      throw mapToORPCError(result.error);
    }
    return result.value;
  });
