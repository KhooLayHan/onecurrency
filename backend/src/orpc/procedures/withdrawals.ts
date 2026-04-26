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
      status: z.literal("processing"),
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

export const getHistory = base
  .use(requireAuth)
  .route({
    method: "GET",
    path: "/withdrawals/history",
    summary: "Get cash-out history for the authenticated user",
    tags: ["Withdrawals"],
  })
  .output(
    z.array(
      z.object({
        id: z.string(),
        publicId: z.string(),
        type: z.literal("cash_out"),
        amountCents: z.number(),
        status: z.enum([
          "pending",
          "processing",
          "completed",
          "failed",
          "refunded",
        ]),
        createdAt: z.date(),
      })
    )
  )
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
      throw mapToORPCError(result.error);
    }
    return result.value;
  });
