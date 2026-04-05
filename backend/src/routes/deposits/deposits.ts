import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { StatusCodes } from "http-status-codes";
import { ResultAsync } from "neverthrow";
import { Stripe } from "stripe";
import type { AppError } from "@/common/errors/base";
import { ExternalServiceError } from "@/common/errors/infrastructure";
import { withTransaction } from "@/src/lib/transaction";
import { BlockchainTransactionRepository } from "@/src/repositories/blockchain-transaction.repository";
import { DepositRepository } from "@/src/repositories/deposit.repository";
import { UserRepository } from "@/src/repositories/user.repository";
import { WalletRepository } from "@/src/repositories/wallet.repository";
import { WebhookEventRepository } from "@/src/repositories/webhook-event.repository";
import { MIN_CONFIRMATIONS, ZERO_ADDRESS } from "../../constants/blockchain";
import { KYC_STATUS } from "../../constants/kyc-status";
import { TRANSACTION_STATUS } from "../../constants/transaction-status";
import { TRANSACTION_TYPE } from "../../constants/transaction-type";
import { db } from "../../db";
import { webhookEvents } from "../../db/schema/webhook-events";
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
import { calculateTokenAmountWei, stripe } from "../../services/stripe.service";
import { verifyStripeWebhookSignature } from "./helpers";

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

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );

    await db.insert(webhookEvents).values({
      stripeEventId: event.id,
      eventType: event.type,
      payload: event,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    if (err instanceof Stripe.errors.StripeSignatureVerificationError) {
      logger.error({ err }, "Webhook signature verification failed!");
      return c.text(`Webhook Error: ${err.message}`, StatusCodes.BAD_REQUEST);
    }

    logger.error({ err }, "Webhook construction failed");
    return c.text(`Webhook Error: ${message}`, StatusCodes.BAD_REQUEST);
  }

  if (event.type === "checkout.session.completed") {
    const checkoutSession = event.data.object;

    const userId = checkoutSession.metadata?.userId;
    const walletId = checkoutSession.metadata?.walletId;
    const amountCents = checkoutSession.amount_total;

    if (!(userId && walletId && amountCents)) {
      logger.error(
        { eventId: event.id, userId, walletId, amountCents },
        "CRITICAL: Missing required metadata in checkout session"
      );

      return c.text(
        "Missing required metadata",
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }

    logger.info(
      { eventId: event.id, userId, amountCents },
      "Processing successful payment webhook"
    );

    // Phase 1: Check idempotency
    const existingEventResult = await new WebhookEventRepository(
      db
    ).findByStripeEventId(event.id);

    if (existingEventResult.isErr()) {
      logger.error(
        { err: existingEventResult.error },
        "Failed to check webhook idempotency"
      );

      return handleApiError(c, existingEventResult.error);
    }

    // Phase 1.5: Create webhook event record (outside transaction, for idempotency)
    const createWebhookResult = await new WebhookEventRepository(db).create({
      stripeEventId: event.id,
      eventType: event.type,
      payload: event,
    });

    if (createWebhookResult.isErr()) {
      logger.error(
        { err: createWebhookResult.error },
        "Failed to create webhook event record"
      );

      return handleApiError(c, createWebhookResult.error);
    }

    // Phase 2: Create deposit record (outside transaction, to establish idempotency for retry)
    const tokenAmountWei = calculateTokenAmountWei(amountCents);

    const createDepositResult = await new DepositRepository(db).create({
      userId: BigInt(userId),
      walletId: BigInt(walletId),
      amountCents: BigInt(amountCents),
      tokenAmount: tokenAmountWei,
      stripePaymentIntentId: checkoutSession.payment_intent as string,
      statusId: TRANSACTION_STATUS.PROCESSING,
      stripeSessionId: checkoutSession.id,
    });

    if (createDepositResult.isErr()) {
      logger.error(
        { err: createDepositResult.error },
        "Failed to create deposit record"
      );

      return handleApiError(c, createDepositResult.error);
    }

    const deposit = createDepositResult.value;

    // Fetch wallet for address
    const walletResult = await new WalletRepository(db).findById(
      BigInt(walletId)
    );

    if (walletResult.isErr()) {
      logger.error(
        { err: walletResult.error },
        "Failed to fetch wallet for mint"
      );

      await new DepositRepository(db).updateStatus(
        BigInt(deposit.id),
        TRANSACTION_STATUS.FAILED
      );

      return handleApiError(c, walletResult.error);
    }

    const walletRecord = walletResult.value;

    if (!walletRecord) {
      logger.error({ walletId }, "CRITICAL: Paid wallet not found in DB!");

      await new DepositRepository(db).updateStatus(
        BigInt(deposit.id),
        TRANSACTION_STATUS.FAILED
      );

      return c.text("Wallet not found", StatusCodes.INTERNAL_SERVER_ERROR);
    }

    // Phase 3: Blockchain mint (outside transaction, cannot be rolled back)
    const mintResult = await mintTokens(walletRecord.address, tokenAmountWei);

    if (mintResult.isErr()) {
      logger.error(
        { err: mintResult.error },
        "Bridge Failed: Could not mint tokens on-chain"
      );

      const updateFailedResult = await new DepositRepository(db).updateStatus(
        BigInt(deposit.id),
        TRANSACTION_STATUS.FAILED
      );

      if (updateFailedResult.isErr()) {
        logger.error(
          { err: updateFailedResult.error },
          "Failed to mark deposit as failed"
        );
      }

      return c.text(
        "Blockchain minting failed",
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }

    const txHash = mintResult.value;

    // Phase 4: Atomic finalization (blockchain tx + deposit completion + webhook mark processed)
    const finalizeResult = await withTransaction(db, (tx) =>
      new BlockchainTransactionRepository(tx)
        .create({
          networkId: walletRecord.networkId,
          transactionTypeId: TRANSACTION_TYPE.MINT,
          fromAddress: ZERO_ADDRESS,
          toAddress: walletRecord.address,
          txHash,
          amount: tokenAmountWei,
          isConfirmed: true,
          confirmations: MIN_CONFIRMATIONS,
        })
        .andThen((blockchainTx) =>
          new DepositRepository(tx).complete(
            BigInt(deposit.id),
            BigInt(blockchainTx.id)
          )
        )
        .andThen(() => new WebhookEventRepository(tx).markProcessed(event.id))
    );

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
  }
  return c.json({ received: true });
});

export const depositsRouter = app;
