import { Hono } from "hono";
import { StatusCodes } from "http-status-codes";
import type Stripe from "stripe";
import { db } from "../../db";
import { handleApiError } from "../../lib/api-response";
import { logger } from "../../lib/logger";
import { DepositService } from "../../services/deposit.service";
import { verifyStripeWebhookSignature } from "./helpers";

const app = new Hono();

const depositService = new DepositService(db);

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
