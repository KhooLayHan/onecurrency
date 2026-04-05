import { sValidator } from "@hono/standard-validator";
import { DatabaseError } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { StatusCodes } from "http-status-codes";
import Stripe from "stripe";
import z from "zod";
import { AMOUNT_CENTS, DEPOSIT_MAX } from "@/common/index";
import { db } from "../db";
import { blockchainTransactions } from "../db/schema/blockchain-transactions";
import { deposits } from "../db/schema/deposits";
import { users } from "../db/schema/users";
import { wallets } from "../db/schema/wallets";
import { webhookEvents } from "../db/schema/webhook-events";
import { env } from "../env";
import { handleApiError } from "../lib/api-response";
import { ExternalServiceError } from "../lib/errors";
import { logger } from "../lib/logger";
import { mintTokens } from "../services/blockchain";
import { calculateTokenAmountWei, stripe } from "../services/stripe.service";

// const app = new Hono();

const app = new Hono<{ Variables: { session: { userId: number } } }>();

app.post("/test-mint", async (c) => {
  const { address, amountWei } = await c.req.json();
  const mintResult = await mintTokens(address, amountWei);

  logger.debug(mintResult, "Mint result received");

  if (mintResult.isErr()) {
    return handleApiError(c, mintResult.error);
  }

  return c.json({
    success: true,
    data: {
      txHash: mintResult.value,
    },
  });
});

// const app = new Hono<{ Variables: { session: { userId: number } } }>();

app.post(
  "/checkout",
  sValidator(
    "json",
    z.object({
      amountCents: z
        .number()
        .int()
        .min(AMOUNT_CENTS)
        .max(DEPOSIT_MAX, "Maximum is $10,000.00"), // Min $10.00
      walletId: z.number().int().positive(), // The ID of the wallet receiving the funds
    })
  ),
  async (c) => {
    // const reqLogger = logger("info");
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

    const KYC_STATUS_VERIFIED_ID = 3;

    // Re-validate KYC before creating deposit/minting
    const currentUser = await db._query.users.findFirst({
      where: eq(users.id, BigInt(userId)),
    });

    if (!currentUser || currentUser.kycStatusId !== KYC_STATUS_VERIFIED_ID) {
      return c.text("KYC no longer valid", StatusCodes.FORBIDDEN);
    }

    if (!userRecord || userRecord.kycStatusId !== KYC_STATUS_VERIFIED_ID) {
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
          userId,
          walletId,
        },
      });

      logger.info(
        { sessionId: session_.id, amountCents },
        "Stripe checkout session created"
      );
      return c.json({ success: true, checkoutUrl: session_.url });
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
  }
);

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ignore for now, will fix
app.post("/webhook", async (c) => {
  // const reqLogger = c.get("logger");
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
    ); // issue is here?

    // 1. Audit Log: Immediately save the webhook event to the database (Idempotency check)
    await db.insert(webhookEvents).values({
      stripeEventId: event.id,
      eventType: event.type,
      payload: event,
    });

    // TODO: Idempotency handling currently drops legitimate Stripe retries after partial failure.
    // const insertedEvent = await db.insert(webhookEvents).values({
    //    stripeEventId: event.id,
    //    eventType: event.type,
    //    payload: event,
    // });

    // on conflict: do not mark as processed yet; decide based on processedAt
    // if already processed -> return 200 duplicate
    // if not processed -> continue processing this retry

    // if (err instanceof DatabaseError && err.code === "23505") {
    //   return c.text("Duplicate", StatusCodes.OK);
    // }
    // Do not blindly ack duplicates; only ack if already processed
  } catch (err) {
    if (err instanceof Stripe.errors.StripeSignatureVerificationError) {
      logger.error({ err }, "Webhook signature verification failed!");
      return c.text(`Webhook Error: ${err.message}`, StatusCodes.BAD_REQUEST);
    }

    // If it violates the UNIQUE constraint, we already processed this webhook!
    if (err instanceof DatabaseError && err.code === "23505") {
      // logger.warn(
      //   { eventId: event?.id },
      //   "Duplicate webhook received and ignored."
      // );
      return c.text("Duplicate", StatusCodes.OK);
    }
    throw err; // Otherwise, crash and let Stripe retry later
  }

  if (event.type === "checkout.session.completed") {
    // 2. Process the Successful Payment
    const session = event.data.object;

    // Extract the metadata we attached during step 1
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

    // Fetch the target wallet address from the DB
    const walletRecord = await db._query.wallets.findFirst({
      where: eq(wallets.id, BigInt(walletId)),
    });

    if (!walletRecord) {
      logger.error({ walletId }, "CRITICAL: Paid wallet not found in DB!");
      return c.text("Wallet not found", StatusCodes.INTERNAL_SERVER_ERROR);
    }

    // Calculate Wei equivalent (1 USD = 1 ONE)
    const tokenAmountWei = calculateTokenAmountWei(amountCents);

    // Create the Pending Deposit Record
    const [deposit] = await db
      .insert(deposits)
      .values({
        userId: BigInt(userId),
        walletId: BigInt(walletId),
        amountCents: BigInt(amountCents),
        tokenAmount: tokenAmountWei,
        stripePaymentIntentId: session.payment_intent as string,
        statusId: 2,
        stripeSessionId: session.id,
      })
      .returning();

    const mintResult = await mintTokens(walletRecord.address, tokenAmountWei);

    if (mintResult.isErr()) {
      logger.error(
        { err: mintResult.error },
        "Bridge Failed: Could not mint tokens on-chain"
      );

      // Update deposit status to failed
      if (deposit) {
        await db
          .update(deposits)
          .set({ statusId: 4 })
          .where(eq(deposits.id, BigInt(deposit?.id)));
      }

      // We return 500 so Stripe knows the fulfillment failed and will retry the webhook later!
      return c.text(
        "Blockchain minting failed",
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }

    // Success! Update the database to reflect the completed bridge.
    const txHash = mintResult.value;

    const [insertedBlockchainTx] = await db
      .insert(blockchainTransactions)
      .values({
        networkId: walletRecord.networkId,
        transactionTypeId: 1,
        fromAddress: "0x0000000000000000000000000000000000000000", // Mints technically come from the zero address
        toAddress: walletRecord.address,
        txHash,
        amount: tokenAmountWei,
        isConfirmed: true, // We wait for 1 confirmation in blockchain.service.ts
        confirmations: 1,
      })
      .returning({ id: blockchainTransactions.id });

    if (deposit) {
      await db
        .update(deposits)
        .set({
          statusId: 3,
          blockchainTxId: insertedBlockchainTx?.id,
          completedAt: new Date(),
        })
        .where(eq(deposits.id, deposit.id));
    }

    // Mark webhook as successfully processed
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

  // Return 200 OK to tell Stripe we received the event
  return c.json({ received: true });
});

export const depositsRouter = app;
