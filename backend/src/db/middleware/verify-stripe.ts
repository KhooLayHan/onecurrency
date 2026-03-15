import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { StatusCodes } from "http-status-codes";
import Stripe from "stripe";
import { env } from "@/src/env";

export const verifyStripe = async (c: Context, next: () => Promise<void>) => {
  const signature = c.req.header("stripe-signature");
  const body = await c.req.text();

  if (!signature) {
    throw new HTTPException(StatusCodes.BAD_REQUEST, {
      message: "Missing signature",
    });
  }

  try {
    const event = await Stripe.webhooks.constructEventAsync(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
    c.set("event", event);
    await next();
  } catch (_err) {
    throw new HTTPException(StatusCodes.BAD_REQUEST, {
      message: "Webhook verification failed",
    });
  }
};
