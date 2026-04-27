import { ORPCError } from "@orpc/server";
import z from "zod";
import { db } from "@/src/db";
import {
  createCheckoutSchema,
  testMintRequestSchema,
} from "@/src/dto/deposit.dto";
import { env } from "@/src/env";
import { logger } from "@/src/lib/logger";
import { DepositRepository } from "@/src/repositories/deposit.repository";
import { DepositService } from "@/src/services/deposit.service";
import { base } from "../context";
import { mapToORPCError } from "../errors";
import { requireAuth } from "../middleware";

const depositService = new DepositService(db);
const depositRepository = new DepositRepository(db);

// Only available in non-production environments
const isProduction = env.NODE_ENV === "production";

export const testMint = base
  .route({
    method: "POST",
    path: "/deposits/test-mint",
    summary: "Test token minting (dev only)",
    tags: ["Deposits"],
  })
  .input(testMintRequestSchema)
  .output(z.object({ txHash: z.string() }))
  .handler(async ({ input }) => {
    // Guard: testMint only available in non-production
    if (isProduction) {
      throw new ORPCError("FORBIDDEN", {
        message: "Test minting not available in production",
      });
    }

    logger.debug(input, "Test mint request received");
    const result = await depositService.testMint(
      input.address,
      input.amountWei
    );
    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }
    return result.value;
  });

export const checkout = base
  .use(requireAuth)
  .route({
    method: "POST",
    path: "/deposits/checkout",
    summary: "Create a Stripe checkout session for a deposit",
    tags: ["Deposits"],
  })
  .input(createCheckoutSchema)
  .output(z.object({ checkoutUrl: z.string() }))
  .handler(async ({ input, context }) => {
    const userId = context.session?.userId;

    // Explicit auth check (requireAuth middleware should already enforce this,
    // but we validate again to fail fast with clear error)
    if (!userId) {
      logger.warn("Checkout called without authenticated session");
      throw new ORPCError("UNAUTHORIZED", {
        message: "Authentication required",
      });
    }

    logger.info({ userId }, "Processing checkout request");
    const result = await depositService.createCheckoutSession(
      BigInt(userId),
      input.amountCents,
      BigInt(input.walletId)
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
    path: "/deposits/history",
    summary: "Get deposit history for the authenticated user",
    tags: ["Deposits"],
  })
  .output(
    z.array(
      z.object({
        id: z.string(),
        publicId: z.string(),
        type: z.literal("add_money"),
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
      logger.warn("getHistory called without authenticated session");
      throw new ORPCError("UNAUTHORIZED", {
        message: "Authentication required",
      });
    }

    logger.info({ userId }, "Fetching deposit history");
    const result = await depositRepository.findByUserId(BigInt(userId));
    if (result.isErr()) {
      logger.error(
        { error: result.error.toLog() },
        "Deposit history query failed"
      );
      throw mapToORPCError(result.error);
    }
    return result.value;
  });
