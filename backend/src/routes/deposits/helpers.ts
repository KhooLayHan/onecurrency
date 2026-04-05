import { errAsync, okAsync, ResultAsync } from "neverthrow";
import Stripe from "stripe";
import type { AppError } from "@/common/errors/base";
import { TRANSACTION_STATUS } from "@/src/constants/transaction-status";
import { db } from "@/src/db";
import { env } from "@/src/env";
import { DepositRepository } from "@/src/repositories/deposit.repository";
import { WebhookEventRepository } from "@/src/repositories/webhook-event.repository";
import { calculateTokenAmountWei } from "@/src/services/stripe.service";

// Stripe signature verification
export function verifyStripeWebhookSignature(
  payload: string,
  signature: string
): ResultAsync<Stripe.Event, Stripe.errors.StripeSignatureVerificationError> {
  return ResultAsync.fromPromise(
    Stripe.webhooks.constructEventAsync(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    ),
    (e): Stripe.errors.StripeSignatureVerificationError => {
      if (e instanceof Stripe.errors.StripeSignatureVerificationError) {
        return e;
      }
      throw e; // Let other errors bubble up to outer catch
    }
  );
}

// Extract and validate webhook payload metadata
export function extractWebhookMetadata(event: Stripe.Event): {
  userId: string;
  walletId: string;
  amountCents: number;
} | null {
  if (event.type !== "checkout.session.completed") {
    return null;
  }

  const session = event.data.object;
  const userId = session.metadata?.userId;
  const walletId = session.metadata?.walletId;
  const amountCents = session.amount_total;

  if (!(userId && walletId && amountCents)) {
    return null;
  }

  return { userId, walletId, amountCents };
}

// Phase 1: Check if webhook event was already processed (idempotency)
async function checkWebhookIdempotency(
  eventId: string
): Promise<ResultAsync<boolean, AppError>> {
  const existingEventResult = await new WebhookEventRepository(
    db
  ).findByStripeEventId(eventId);

  if (existingEventResult.isErr()) {
    return errAsync(existingEventResult.error);
  }

  // true = already processed
  return okAsync(existingEventResult.value !== null);
}

// Phase 1.5: Record webhook event
async function recordWebhookEvent(
  event: Stripe.Event
): Promise<ResultAsync<void, AppError>> {
  const result = await new WebhookEventRepository(db).create({
    stripeEventId: event.id,
    eventType: event.type,
    payload: event,
  });

  return result.map(() => {});
}

// Phase 2: Create deposit record
async function createDepositRecord(params: {
  userId: string;
  walletId: string;
  amountCents: number;
  stripeSessionId: string;
  stripePaymentIntentId: string;
}): Promise<
  ResultAsync<{ deposit: { id: bigint }; tokenAmountWei: string }, AppError>
> {
  const {
    userId,
    walletId,
    amountCents,
    stripeSessionId,
    stripePaymentIntentId,
  } = params;
  const tokenAmountWei = calculateTokenAmountWei(amountCents);

  const result = await new DepositRepository(db).create({
    userId: BigInt(userId),
    walletId: BigInt(walletId),
    amountCents: BigInt(amountCents),
    tokenAmount: tokenAmountWei,
    stripePaymentIntentId,
    statusId: TRANSACTION_STATUS.PROCESSING,
    stripeSessionId,
  });

  return result.map((deposit) => ({
    deposit: { id: deposit.id },
    tokenAmountWei,
  }));
}
