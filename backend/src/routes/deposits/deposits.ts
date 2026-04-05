import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { StatusCodes } from "http-status-codes";
import { ResultAsync } from "neverthrow";
import type { Stripe } from "stripe";
import type { AppError } from "@/common/errors/base";
import { ExternalServiceError } from "@/common/errors/infrastructure";
import { UserRepository } from "@/src/repositories/user.repository";
import { WalletRepository } from "@/src/repositories/wallet.repository";
import { KYC_STATUS } from "../../constants/kyc-status";
import { db } from "../../db";
import {
  type CheckoutResponse,
  createCheckoutSchema,
  type MintTestResponse,
  type StripeCheckoutMetadata,
  testMintRequestSchema,
} from "../../dto/deposit.dto";
import { env } from "../../env";
import { handleApiError } from "../../lib/api-response";
import { logger } from "../../lib/logger";
import { mintTokens } from "../../services/blockchain";
import { stripe } from "../../services/stripe.service";
import {
  checkWebhookIdempotency,
  createDepositRecord,
  executeBlockchainMint,
  extractWebhookMetadata,
  fetchWalletAndValidate,
  finalizeWebhookProcessing,
  recordWebhookEvent,
  verifyStripeWebhookSignature,
} from "./helpers";

const app = new Hono<{ Variables: { session: { userId: number } } }>();

app.post("/test-mint", async (c) => {
  const body = testMintRequestSchema.parse(await c.req.json());
  const { address, amountWei } = body;

  const mintResult = await mintTokens(address, amountWei);

  logger.debug(mintResult, "Mint result received");

  if (mintResult.isErr()) {
    return handleApiError(c, mintResult.error);
  }

  const response: MintTestResponse = { txHash: mintResult.value };
  return c.json({ success: true, data: response });
});

app.post("/checkout", sValidator("json", createCheckoutSchema), async (c) => {
  const { amountCents, walletId } = c.req.valid("json");

  const session = c.get("session");

  if (!session?.userId) {
    return c.json(
      { success: false, error: "Unauthorized" },
      StatusCodes.UNAUTHORIZED
    );
  }

  const userId = session.userId;

  logger.info({ userId: session.userId }, "Processing checkout request");

  const userResult = await new UserRepository(db).findById(BigInt(userId));

  if (userResult.isErr()) {
    logger.error({ err: userResult.error }, "Failed to fetch user");
    return handleApiError(c, userResult.error);
  }

  const userRecord = userResult.value;

  if (!userRecord || userRecord.kycStatusId !== KYC_STATUS.VERIFIED) {
    return c.json(
      {
        success: false,
        error: "KYC_REQUIRED",
        message: "Identity verification is required before making a deposit.",
      },
      StatusCodes.FORBIDDEN
    );
  }

  // Verify wallet belongs to user
  const walletResult = await new WalletRepository(db).requireOwnership(
    BigInt(walletId),
    BigInt(userId)
  );
  if (walletResult.isErr()) {
    return c.json(
      { success: false, error: "Wallet not found or not owned by user" },
      StatusCodes.FORBIDDEN
    );
  }

  // Create Stripe checkout session
  const stripeResult = await ResultAsync.fromPromise(
    stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "OneCurrency (ONE) Deposit",
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${env.CORS_ORIGIN}/dashboard?deposit=success`,
      cancel_url: `${env.CORS_ORIGIN}/dashboard?deposit=cancelled`,
      metadata: {
        userId: String(userId),
        walletId: String(walletId),
      } satisfies StripeCheckoutMetadata,
    }),
    (e): AppError =>
      new ExternalServiceError("Stripe", "Failed to create checkout session", {
        cause: e,
      })
  );

  if (stripeResult.isErr()) {
    return handleApiError(c, stripeResult.error);
  }

  const session_ = stripeResult.value;

  if (!session_.url) {
    return handleApiError(
      c,
      new ExternalServiceError("Stripe", "Checkout session URL not generated")
    );
  }

  logger.info(
    { sessionId: session_.id, amountCents },
    "Stripe checkout session created"
  );

  const response: CheckoutResponse = { checkoutUrl: session_.url };
  return c.json({ success: true, data: response });
});

app.post("/webhook", async (c) => {
  const signature = c.req.header("stripe-signature");

  logger.debug({ hasSignature: !!signature }, "Webhook signature check");

  if (!signature) {
    return c.text("Missing stripe-signature header", StatusCodes.BAD_REQUEST);
  }

  // Stripe requires the raw, unparsed string body to verify the cryptographic signature
  const payload = await c.req.text();

  // Verify signature
  const verifyResult = await verifyStripeWebhookSignature(payload, signature);
  if (verifyResult.isErr()) {
    logger.error(
      { err: verifyResult.error },
      "Webhook signature verification failed!"
    );
    return c.text(
      `Webhook Error: ${verifyResult.error.message}`,
      StatusCodes.BAD_REQUEST
    );
  }

  const event = verifyResult.value;

  // Extract metadata
  const metadata = extractWebhookMetadata(event);

  if (!metadata) {
    logger.error(
      { eventId: event.id, type: event.type },
      "CRITICAL: Missing required metadata in checkout session"
    );

    return c.text(
      "Missing required metadata",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }

  const { userId, walletId, amountCents } = metadata;

  logger.info(
    { eventId: event.id, userId, amountCents },
    "Processing successful payment webhook"
  );

  // Phase 1: Idempotency check
  const idempotencyResult = await checkWebhookIdempotency(event.id);

  if (idempotencyResult.isErr()) {
    logger.error(
      { err: idempotencyResult.error },
      "Failed to check webhook idempotency"
    );

    return handleApiError(c, idempotencyResult.error);
  }

  if (idempotencyResult.value) {
    logger.info({ eventId: event.id }, "Webhook already processed");
    return c.json({ received: true });
  }

  // Phase 1.5: Record webhook event
  const recordResult = await recordWebhookEvent(event);

  if (recordResult.isErr()) {
    logger.error(
      { err: recordResult.error },
      "Failed to create webhook event record"
    );

    return handleApiError(c, recordResult.error);
  }

  const checkoutSession = event.data.object as Stripe.Checkout.Session;

  // Phase 2: Create deposit
  const createDepositResult = await createDepositRecord({
    userId,
    walletId,
    amountCents,
    stripeSessionId: checkoutSession.id,
    stripePaymentIntentId: checkoutSession.payment_intent as string,
  });

  if (createDepositResult.isErr()) {
    logger.error(
      { err: createDepositResult.error },
      "Failed to create deposit record"
    );

    return handleApiError(c, createDepositResult.error);
  }

  const { deposit, tokenAmountWei } = createDepositResult.value;

  // Phase 2b: Fetch and validate wallet
  const walletValidation = await fetchWalletAndValidate(walletId, deposit.id);

  if (walletValidation.isErr()) {
    return handleApiError(c, walletValidation.error);
  }

  if (!walletValidation.value.success) {
    return c.text("Wallet not found", StatusCodes.INTERNAL_SERVER_ERROR);
  }

  const wallet = walletValidation.value.wallet;

  // Phase 3: Blockchain mint
  const mintResult = await executeBlockchainMint({
    walletAddress: wallet.address,
    tokenAmountWei,
    depositId: deposit.id,
  });

  if (mintResult.isErr()) {
    return handleApiError(c, mintResult.error);
  }

  if ("error" in mintResult.value) {
    return c.text(
      "Blockchain minting failed",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }

  const { txHash } = mintResult.value;

  // Phase 4: Atomic finalization
  const finalizeResult = await finalizeWebhookProcessing({
    networkId: wallet.networkId,
    walletAddress: wallet.address,
    txHash,
    tokenAmountWei,
    depositId: deposit.id,
    eventId: event.id,
  });

  if (finalizeResult.isErr()) {
    logger.error(
      { err: finalizeResult.error },
      "Failed to finalize deposit webhook processing"
    );

    return handleApiError(c, finalizeResult.error);
  }

  logger.info(
    { txHash, depositId: deposit.id },
    "Bridge Successful! Tokens minted."
  );

  return c.json({ received: true });
});

export const depositsRouter = app;
