import { sValidator } from "@hono/standard-validator";
import { DatabaseError } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { StatusCodes } from "http-status-codes";
import type Stripe from "stripe";
import z from "zod";
import { db } from "../db";
import { deposits } from "../db/schema/deposits";
import { wallets } from "../db/schema/wallets";
import { webhookEvents } from "../db/schema/webhook-events";
import { env } from "../env";
import { handleApiError } from "../lib/api-response";
import { BusinessRuleError, ExternalServiceError } from "../lib/errors";
import { logger } from "../lib/logger";
import { mintTokens } from "../services/blockchain";
import { calculateTokenAmountWei, stripe } from "../services/stripe.service";

// const app = new Hono();

const app = new Hono<{ Variables: { session: { userId: number } } }>();

app.post("/test-mint", async (c) => {
  const { address, amountWei } = await c.req.json();
  const mintResult = await mintTokens(address, amountWei);

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

const AMOUNT_CENTS = 1000;

// const app = new Hono<{ Variables: { session: { userId: number } } }>();

app.post(
  "/checkout",
  sValidator(
    "json",
    z.object({
      amountCents: z.number().min(AMOUNT_CENTS), // Min $10.00
      walletId: z.number(), // The ID of the wallet receiving the funds
    })
  ),
  async (c) => {
    // const reqLogger = logger("info");
    const { amountCents, walletId } = c.req.valid("json");

    const session = c.get("session");
    const userId = session.userId;

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

  if (!signature) {
    return c.text("Missing stripe-signature header", StatusCodes.BAD_REQUEST);
  }

  // Stripe requires the raw, unparsed string body to verify the cryptographic signature
  const payload = await c.req.text();
  let event: Stripe.Event;

  if (!signature) {
    return c.text("Missing stripe-signature header", StatusCodes.BAD_REQUEST);
  }

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );

    // 1. Audit Log: Immediately save the webhook event to the database (Idempotency check)
    await db.insert(webhookEvents).values({
      stripeEventId: event.id,
      eventType: event.type,
      payload: event,
    });
  } catch (err) {
    if (err instanceof BusinessRuleError) {
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
    const userId = session.metadata?.userId ?? "";
    const walletId = session.metadata?.walletId ?? "";
    const amountCents = session.amount_total || 0;

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

    // 🚀 FIRE THE BLOCKCHAIN MINT TRANSACTION 🚀
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
    const txHash = BigInt(mintResult.value);

    if (deposit) {
      await db
        .update(deposits)
        .set({
          statusId: 3,
          blockchainTxId: txHash,
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
