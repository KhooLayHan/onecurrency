import z from "zod";
import { db } from "@/src/db";
import {
  createCheckoutSchema,
  testMintRequestSchema,
} from "@/src/dto/deposit.dto";
import { logger } from "@/src/lib/logger";
import { DepositService } from "@/src/services/deposit.service";
import { base } from "../context";
import { mapToORPCError } from "../errors";
import { requireAuth } from "../middleware";

const depositService = new DepositService(db);

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
    logger.info({ userId }, "Processing checkout request");
    const result = await depositService.createCheckoutSession(
      BigInt(userId ?? 0),
      input.amountCents,
      BigInt(input.walletId)
    );
    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }
    return result.value;
  });
