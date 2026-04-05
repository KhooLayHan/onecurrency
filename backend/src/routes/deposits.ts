import { sValidator } from "@hono/standard-validator";
import { DatabaseError } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { StatusCodes } from "http-status-codes";
import { Stripe } from "stripe";
import { MIN_CONFIRMATIONS, ZERO_ADDRESS } from "../constants/blockchain";
import { KYC_STATUS } from "../constants/kyc-status";
import { TRANSACTION_STATUS } from "../constants/transaction-status";
import { TRANSACTION_TYPE } from "../constants/transaction-type";
import { db } from "../db";
import { blockchainTransactions } from "../db/schema/blockchain-transactions";
import { deposits } from "../db/schema/deposits";
import { users } from "../db/schema/users";
import { wallets } from "../db/schema/wallets";
import { webhookEvents } from "../db/schema/webhook-events";
import {
  type CheckoutResponse,
  createCheckoutSchema,
  type MintTestResponse,
  type StripeCheckoutMetadata,
  testMintRequestSchema,
} from "../dto/deposit.dto";
import { env } from "../env";
import { handleApiError } from "../lib/api-response";
import { ExternalServiceError } from "../lib/errors";
import { logger } from "../lib/logger";
import { mintTokens } from "../services/blockchain";
import { calculateTokenAmountWei, stripe } from "../services/stripe.service";

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

  const userRecord = await db._query.users.findFirst({
    where: eq(users.id, BigInt(session.userId)),
  });

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
  const walletRecord = await db._query.wallets.findFirst({
    where: eq(wallets.id, BigInt(walletId)),
  });

  if (!walletRecord || walletRecord.userId !== BigInt(userId)) {
    return c.json(
      { success: false, error: "Wallet not found or not owned by user" },
      StatusCodes.FORBIDDEN
    );
  }

  try {
    const session_ = await stripe.checkout.sessions.create({
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
    });

    if (!session_.url) {
      return handleApiError(
        c,
        new ExternalServiceError(
          "STRIPE_API_ERROR",
          "Checkout session URL not generated",
          {}
        )
      );
    }

    logger.info(
      { sessionId: session_.id, amountCents },
      "Stripe checkout session created"
    );

    const response: CheckoutResponse = { checkoutUrl: session_.url };
    return c.json({ success: true, data: response });
  } catch (e) {
    return handleApiError(
      c,
      new ExternalServiceError(
        "STRIPE_API_ERROR",
        "Failed to create checkout session",
        { e }
      )
    );
  }
});

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ignore for now, will fix
app.post("/webhook", async (c) => {
  const signature = c.req.header("stripe-signature");

  logger.debug({ hasSignature: !!signature }, "Webhook signature check");

  if (!signature) {
    return c.text("Missing stripe-signature header", StatusCodes.BAD_REQUEST);
  }

  // Stripe requires the raw, unparsed string body to verify the cryptographic signature
  const payload = await c.req.text();
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
    if (err instanceof Stripe.errors.StripeSignatureVerificationError) {
      logger.error({ err }, "Webhook signature verification failed!");
      return c.text(`Webhook Error: ${err.message}`, StatusCodes.BAD_REQUEST);
    }

    if (err instanceof DatabaseError && err.code === "23505") {
      return c.text("Duplicate", StatusCodes.OK);
    }
    throw err;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const userId = session.metadata?.userId;
    const walletId = session.metadata?.walletId;
    const amountCents = session.amount_total;

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

    const walletRecord = await db._query.wallets.findFirst({
      where: eq(wallets.id, BigInt(walletId)),
    });

    if (!walletRecord) {
      logger.error({ walletId }, "CRITICAL: Paid wallet not found in DB!");
      return c.text("Wallet not found", StatusCodes.INTERNAL_SERVER_ERROR);
    }

    const tokenAmountWei = calculateTokenAmountWei(amountCents);

    const [deposit] = await db
      .insert(deposits)
      .values({
        userId: BigInt(userId),
        walletId: BigInt(walletId),
        amountCents: BigInt(amountCents),
        tokenAmount: tokenAmountWei,
        stripePaymentIntentId: session.payment_intent as string,
        statusId: TRANSACTION_STATUS.PROCESSING,
        stripeSessionId: session.id,
      })
      .returning();

    const mintResult = await mintTokens(walletRecord.address, tokenAmountWei);

    if (mintResult.isErr()) {
      logger.error(
        { err: mintResult.error },
        "Bridge Failed: Could not mint tokens on-chain"
      );

      if (deposit) {
        await db
          .update(deposits)
          .set({ statusId: TRANSACTION_STATUS.FAILED })
          .where(eq(deposits.id, BigInt(deposit.id)));
      }

      return c.text(
        "Blockchain minting failed",
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }

    const txHash = mintResult.value;

    const [insertedBlockchainTx] = await db
      .insert(blockchainTransactions)
      .values({
        networkId: walletRecord.networkId,
        transactionTypeId: TRANSACTION_TYPE.MINT,
        fromAddress: ZERO_ADDRESS,
        toAddress: walletRecord.address,
        txHash,
        amount: tokenAmountWei,
        isConfirmed: true,
        confirmations: MIN_CONFIRMATIONS,
      })
      .returning({ id: blockchainTransactions.id });

    if (deposit) {
      await db
        .update(deposits)
        .set({
          statusId: TRANSACTION_STATUS.COMPLETED,
          blockchainTxId: insertedBlockchainTx?.id,
          completedAt: new Date(),
        })
        .where(eq(deposits.id, deposit.id));
    }

    await db
      .update(webhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(webhookEvents.stripeEventId, event.id));

    if (deposit) {
      logger.info(
        { txHash, depositId: deposit.id },
        "Bridge Successful! Tokens minted."
      );
    }
  }

  return c.json({ received: true });
});

export const depositsRouter = app;
