import { errAsync, okAsync, ResultAsync } from "neverthrow";
import Stripe from "stripe";
import type { AppError } from "@/common/errors/base";
import { ExternalServiceError } from "@/common/errors/infrastructure";
import { MIN_CONFIRMATIONS, ZERO_ADDRESS } from "@/src/constants/blockchain";
import { TRANSACTION_STATUS } from "@/src/constants/transaction-status";
import { TRANSACTION_TYPE } from "@/src/constants/transaction-type";
import type { Database } from "@/src/db";
import type { WebhookEvent } from "@/src/db/schema/webhook-events";
import { env } from "@/src/env";
import { logger } from "@/src/lib/logger";
import { withTransaction } from "@/src/lib/transaction";
import { BlockchainTransactionRepository } from "@/src/repositories/blockchain-transaction.repository";
import { DepositRepository } from "@/src/repositories/deposit.repository";
import { WalletRepository } from "@/src/repositories/wallet.repository";
import { WebhookEventRepository } from "@/src/repositories/webhook-event.repository";
import { mintTokens } from "@/src/services/blockchain";
import { calculateTokenAmountWei, stripe } from "@/src/services/stripe.service";

// --- Pure helpers (no database dependency) ---

/**
 * Verifies the Stripe webhook signature and constructs the event.
 * Non-signature errors are rethrown so the caller gets a 500 instead of 400.
 */
export function verifyStripeWebhookSignature(
  payload: string,
  signature: string
): ResultAsync<Stripe.Event, Stripe.errors.StripeSignatureVerificationError> {
  return ResultAsync.fromPromise(
    stripe.webhooks.constructEventAsync(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    ),
    (e): Stripe.errors.StripeSignatureVerificationError => {
      if (e instanceof Stripe.errors.StripeSignatureVerificationError) {
        return e;
      }
      // Rethrow unexpected errors so they surface as 500, not 400
      throw new Error(
        `Unexpected Stripe error: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  );
}

export type ExtractMetadataResult =
  | { type: "unsupported_event" }
  | { type: "invalid_metadata" }
  | { type: "ok"; userId: string; walletId: string; amountCents: number };

/**
 * Extracts and validates the required metadata from a Stripe webhook event.
 */
export function extractWebhookMetadata(
  event: Stripe.Event
): ExtractMetadataResult {
  if (event.type !== "checkout.session.completed") {
    return { type: "unsupported_event" };
  }

  const session = event.data.object;
  const userId = session.metadata?.userId;
  const walletId = session.metadata?.walletId;
  const amountCents = session.amount_total;

  if (!(userId && walletId && amountCents)) {
    return { type: "invalid_metadata" };
  }

  return { type: "ok", userId, walletId, amountCents };
}

// --- Database-dependent helpers ---

/**
 * Phase 1: Checks whether a Stripe webhook event has already been processed.
 * Returns true if already processed (idempotency hit).
 */
export function checkWebhookIdempotency(
  db: Database,
  eventId: string
): ResultAsync<boolean, AppError> {
  return new WebhookEventRepository(db)
    .findByStripeEventId(eventId)
    .map((existing) => existing !== null);
}

/**
 * Phase 1.5: Records the incoming Stripe webhook event to establish idempotency.
 * Returns the created record; callers that don't need the value can ignore it
 * via `andThen(() => nextStep())`.
 */
export function recordWebhookEvent(
  db: Database,
  event: Stripe.Event
): ResultAsync<WebhookEvent, AppError> {
  return new WebhookEventRepository(db).create({
    stripeEventId: event.id,
    eventType: event.type,
    payload: event,
  });
}

/**
 * Phase 2: Creates the deposit record in PROCESSING state.
 * Also calculates the token amount (Wei) from the fiat amount.
 */
export function createDepositRecord(
  db: Database,
  params: {
    userId: string;
    walletId: string;
    amountCents: number;
    stripeSessionId: string;
    stripePaymentIntentId: string;
  }
): ResultAsync<{ deposit: { id: bigint }; tokenAmountWei: string }, AppError> {
  const {
    userId,
    walletId,
    amountCents,
    stripeSessionId,
    stripePaymentIntentId,
  } = params;
  const tokenAmountWei = calculateTokenAmountWei(amountCents);

  return new DepositRepository(db)
    .create({
      userId: BigInt(userId),
      walletId: BigInt(walletId),
      amountCents: BigInt(amountCents),
      tokenAmount: tokenAmountWei,
      stripePaymentIntentId,
      statusId: TRANSACTION_STATUS.PROCESSING,
      stripeSessionId,
    })
    .map((deposit) => ({ deposit: { id: deposit.id }, tokenAmountWei }));
}

/**
 * Phase 2.5: Fetches the wallet required for minting.
 * On any error (DB failure or wallet not found), marks the deposit as FAILED
 * and propagates the original error.
 */
export function fetchWalletForMint(
  db: Database,
  walletId: string,
  depositId: bigint
): ResultAsync<{ address: string; networkId: number }, AppError> {
  return new WalletRepository(db)
    .findById(BigInt(walletId))
    .andThen((wallet) => {
      if (!wallet) {
        logger.error({ walletId }, "CRITICAL: Paid wallet not found in DB!");
        return errAsync(
          new ExternalServiceError("Database", "Wallet not found for minting", {
            context: { walletId },
          }) as AppError
        );
      }
      return okAsync({ address: wallet.address, networkId: wallet.networkId });
    })
    .orElse((error) =>
      // Best-effort: mark deposit failed; always propagate the original error
      new DepositRepository(db)
        .updateStatus(depositId, TRANSACTION_STATUS.FAILED)
        .orElse(() => okAsync(undefined))
        .andThen(() => errAsync(error))
    );
}

/**
 * Phase 3: Executes the on-chain token mint.
 * On failure, marks the deposit as FAILED and propagates the error.
 * Returns the transaction hash on success.
 */
export function executeBlockchainMint(
  db: Database,
  params: {
    walletAddress: string;
    tokenAmountWei: string;
    depositId: bigint;
  }
): ResultAsync<string, AppError> {
  const { walletAddress, tokenAmountWei, depositId } = params;

  return mintTokens(walletAddress, tokenAmountWei).orElse((error) => {
    logger.error(
      { err: error },
      "Bridge Failed: Could not mint tokens on-chain"
    );
    return new DepositRepository(db)
      .updateStatus(depositId, TRANSACTION_STATUS.FAILED)
      .orElse(() => okAsync(undefined))
      .andThen(() => errAsync(error));
  });
}

/**
 * Phase 4: Atomically finalizes the webhook — inserts the blockchain tx record,
 * marks the deposit as COMPLETED, and marks the webhook event as processed.
 * All three writes are wrapped in a single database transaction.
 */
export function finalizeWebhookProcessing(
  db: Database,
  params: {
    networkId: number;
    walletAddress: string;
    txHash: string;
    tokenAmountWei: string;
    depositId: bigint;
    eventId: string;
  }
): ResultAsync<void, AppError> {
  const {
    networkId,
    walletAddress,
    txHash,
    tokenAmountWei,
    depositId,
    eventId,
  } = params;

  return withTransaction(db, (tx) =>
    new BlockchainTransactionRepository(tx)
      .create({
        networkId,
        transactionTypeId: TRANSACTION_TYPE.MINT,
        fromAddress: ZERO_ADDRESS,
        toAddress: walletAddress,
        txHash,
        amount: tokenAmountWei,
        isConfirmed: true,
        confirmations: MIN_CONFIRMATIONS,
      })
      .andThen((blockchainTx) =>
        new DepositRepository(tx).complete(depositId, BigInt(blockchainTx.id))
      )
      .andThen(() => new WebhookEventRepository(tx).markProcessed(eventId))
  );
}
