import { Hono } from "hono";
import { StatusCodes } from "http-status-codes";
import type Stripe from "stripe";
import { db } from "../../db";
import { createCheckoutSchema } from "../../dto/deposit.dto";
import { env } from "../../env";
import { handleApiError } from "../../lib/api-response";
import { logger } from "../../lib/logger";
import { DepositService } from "../../services/deposit.service";
import { verifyStripeWebhookSignature } from "./helpers";

type Variables = {
  session: { userId: string } | null;
};

const app = new Hono<{ Variables: Variables }>();

const depositService = new DepositService(db);

/**
 * Dev-only Hono checkout endpoint.
 * Mirrors oRPC /deposits/checkout to test whether webhook triggers
 * differ between oRPC and raw Hono routes.
 */
app.post("/checkout-hono", async (c) => {
  let userId: string | undefined;

  // Dev bypass: allow overriding userId via query or header when no session
  const session = c.get("session");
  if (session?.userId) {
    userId = session.userId;
  } else if (env.NODE_ENV !== "production") {
    userId = c.req.query("userId") ?? c.req.header("x-user-id");
    if (userId) {
      logger.warn({ userId }, "checkout-hono: using dev bypass auth");
    }
  }

  if (!userId) {
    return c.json(
      { error: "Authentication required" },
      StatusCodes.UNAUTHORIZED
    );
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, StatusCodes.BAD_REQUEST);
  }

  const parsed = createCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.issues },
      StatusCodes.BAD_REQUEST
    );
  }

  const { amountCents, walletId } = parsed.data;

  logger.info({ userId, amountCents, walletId }, "checkout-hono: starting");

  const result = await depositService.createCheckoutSession(
    BigInt(userId),
    amountCents,
    BigInt(walletId)
  );

  if (result.isErr()) {
    logger.error({ err: result.error }, "checkout-hono: failed");
    return handleApiError(c, result.error);
  }

  return c.json({ checkoutUrl: result.value.checkoutUrl });
});

/**
 * Stripe webhook receiver.
 * Kept as a raw Hono route because Stripe signature verification requires
 * the unparsed request body — oRPC's handler would consume it first.
 */
app.post("/webhook", async (c) => {
  logger.info("Stripe webhook endpoint hit");

  const signature = c.req.header("stripe-signature");
  logger.debug({ hasSignature: !!signature }, "Webhook signature check");

  if (!signature) {
    return c.text("Missing stripe-signature header", StatusCodes.BAD_REQUEST);
  }

  const payload = await c.req.text();
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

  logger.info(
    {
      eventId: event.id,
      eventType: event.type,
      sessionId: (event.data.object as Stripe.Checkout.Session)?.id,
    },
    "Stripe webhook received and verified"
  );

  const result = await depositService.processSuccessfulPayment(event);

  if (result.isErr()) {
    logger.error({ err: result.error }, "Webhook processing failed");
    return handleApiError(c, result.error);
  }

  return c.json({ received: true });
});

export const depositsWebhookRouter = app;
