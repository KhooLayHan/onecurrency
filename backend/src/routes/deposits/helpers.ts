import { errAsync, okAsync, ResultAsync } from "neverthrow";
import Stripe from "stripe";
import type { AppError } from "@/common/errors/base";
import { ExternalServiceError } from "@/common/errors/infrastructure";
import { MIN_CONFIRMATIONS, ZERO_ADDRESS } from "@/src/constants/blockchain";
import { TRANSACTION_STATUS } from "@/src/constants/transaction-status";
import { TRANSACTION_TYPE } from "@/src/constants/transaction-type";
import { db } from "@/src/db";
import { env } from "@/src/env";
import { logger } from "@/src/lib/logger";
import { withTransaction } from "@/src/lib/transaction";
import { BlockchainTransactionRepository } from "@/src/repositories/blockchain-transaction.repository";
import { DepositRepository } from "@/src/repositories/deposit.repository";
import { WalletRepository } from "@/src/repositories/wallet.repository";
import { WebhookEventRepository } from "@/src/repositories/webhook-event.repository";
import { mintTokens } from "@/src/services/blockchain";
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
export async function checkWebhookIdempotency(
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
export async function recordWebhookEvent(
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
export async function createDepositRecord(params: {
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

// Phase 2b: Fetch wallet for address
export function fetchWalletForMint(_walletId: string): Promise<
  ResultAsync<
    {
      walletRecord: { id: bigint; address: string; networkId: number };
      depositId: bigint;
    },
    AppError
  >
> {
  // This needs depositId to mark as failed if wallet not found
  // Refactored to accept depositId as parameter
  throw new Error("Use fetchWalletAndValidate instead");
}

export async function fetchWalletAndValidate(
  walletId: string,
  depositId: bigint
): Promise<
  ResultAsync<
    | { success: true; wallet: { address: string; networkId: number } }
    | { success: false; error: AppError },
    AppError
  >
> {
  const walletResult = await new WalletRepository(db).findById(
    BigInt(walletId)
  );
  if (walletResult.isErr()) {
    logger.error(
      { err: walletResult.error },
      "Failed to fetch wallet for mint"
    );

    await new DepositRepository(db).updateStatus(
      depositId,
      TRANSACTION_STATUS.FAILED
    );

    return okAsync({ success: false, error: walletResult.error });
  }

  const wallet = walletResult.value;

  if (!wallet) {
    logger.error({ walletId }, "CRITICAL: Paid wallet not found in DB!");

    await new DepositRepository(db).updateStatus(
      depositId,
      TRANSACTION_STATUS.FAILED
    );

    return okAsync({
      success: false,
      error: new ExternalServiceError(
        "Database",
        "Wallet not found"
      ) as AppError,
    });
  }

  return okAsync({
    success: true,
    wallet: { address: wallet.address, networkId: wallet.networkId },
  });
}

// Phase 3: Execute blockchain mint
export async function executeBlockchainMint(params: {
  walletAddress: string;
  tokenAmountWei: string;
  depositId: bigint;
}): Promise<ResultAsync<{ txHash: string } | { error: AppError }, AppError>> {
  const { walletAddress, tokenAmountWei, depositId } = params;
  const mintResult = await mintTokens(walletAddress, tokenAmountWei);

  if (mintResult.isErr()) {
    logger.error(
      { err: mintResult.error },
      "Bridge Failed: Could not mint tokens on-chain"
    );

    await new DepositRepository(db).updateStatus(
      depositId,
      TRANSACTION_STATUS.FAILED
    );

    return okAsync({ error: mintResult.error });
  }

  return okAsync({ txHash: mintResult.value });
}

// Phase 4: Atomic finalization (blockchain tx record + deposit complete + webhook processed)
export function finalizeWebhookProcessing(params: {
  networkId: number;
  walletAddress: string;
  txHash: string;
  tokenAmountWei: string;
  depositId: bigint;
  eventId: string;
}): Promise<ResultAsync<void, AppError>> {
  const {
    networkId,
    walletAddress,
    txHash,
    tokenAmountWei,
    depositId,
    eventId,
  } = params;

  return withTransaction(db, (tx) => {
    const blockchainTxRepo = new BlockchainTransactionRepository(tx);
    const depositRepo = new DepositRepository(tx);
    const webhookRepo = new WebhookEventRepository(tx);

    return blockchainTxRepo
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
        depositRepo.complete(depositId, BigInt(blockchainTx.id))
      )
      .andThen(() => webhookRepo.markProcessed(eventId));
  });
}
