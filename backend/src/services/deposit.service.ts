import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type Stripe from "stripe";
import type { AppError } from "@/common/errors/base";
import { DepositKycRequiredError } from "@/common/errors/deposit";
import { ExternalServiceError } from "@/common/errors/infrastructure";
import { KYC_STATUS } from "../constants/kyc-status";
import { TRANSACTION_STATUS } from "../constants/transaction-status";
import type { Database } from "../db";
import { env } from "../env";
import { logger } from "../lib/logger";
import { DepositRepository } from "../repositories/deposit.repository";
import { UserRepository } from "../repositories/user.repository";
import { WalletRepository } from "../repositories/wallet.repository";
import {
  checkWebhookIdempotency,
  createDepositRecord,
  executeBlockchainMint,
  extractWebhookMetadata,
  fetchWalletForMint,
  finalizeWebhookProcessing,
  recordWebhookEvent,
} from "../routes/deposits/helpers";
import { mintTokens } from "./blockchain";
import { calculateTokenAmountWei, stripe } from "./stripe.service";

export class DepositService {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  testMint(
    address: string,
    amountWei: string
  ): ResultAsync<{ txHash: string }, AppError> {
    return mintTokens(address, amountWei).map((txHash) => ({ txHash }));
  }

  createCheckoutSession(
    userId: bigint,
    amountCents: number,
    walletId: bigint
  ): ResultAsync<{ checkoutUrl: string }, AppError> {
    return new UserRepository(this.db)
      .findById(userId)
      .andThen((user) => {
        if (!user || user.kycStatusId !== KYC_STATUS.VERIFIED) {
          return errAsync(new DepositKycRequiredError());
        }
        return new WalletRepository(this.db).requireOwnership(walletId, userId);
      })
      .andThen(() =>
        ResultAsync.fromPromise(
          stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [
              {
                price_data: {
                  currency: "usd",
                  product_data: { name: "OneCurrency (ONE) Deposit" },
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
            },
          }),
          (e): AppError =>
            new ExternalServiceError(
              "Stripe",
              "Failed to create checkout session",
              { cause: e }
            )
        )
      )
      .andThen((session) => {
        if (!session.url) {
          return errAsync(
            new ExternalServiceError(
              "Stripe",
              "Checkout session URL not generated"
            )
          );
        }

        const tokenAmountWei = calculateTokenAmountWei(amountCents);

        return new DepositRepository(this.db)
          .create({
            userId,
            walletId,
            amountCents: BigInt(amountCents),
            tokenAmount: tokenAmountWei,
            stripeSessionId: session.id,
            statusId: TRANSACTION_STATUS.PENDING,
          })
          .map(() => ({ checkoutUrl: session.url as string }));
      });
  }

  /**
   * Orchestrates the full Stripe payment → on-chain mint bridge flow.
   * Delegates each phase to the typed helpers in routes/deposits/helpers.ts.
   */
  processSuccessfulPayment(event: Stripe.Event): ResultAsync<void, AppError> {
    if (event.type !== "checkout.session.completed") {
      return okAsync(undefined);
    }

    const checkoutSession = event.data.object as Stripe.Checkout.Session;
    const metadata = extractWebhookMetadata(event);

    if (metadata.type !== "ok") {
      logger.error(
        { eventId: event.id },
        "CRITICAL: Missing required metadata in checkout session"
      );
      return errAsync(
        new ExternalServiceError(
          "Stripe",
          "Missing required metadata in checkout session",
          { context: { eventId: event.id } }
        )
      );
    }

    const { userId, walletId, amountCents } = metadata;

    const paymentIntentId =
      typeof checkoutSession.payment_intent === "string"
        ? checkoutSession.payment_intent
        : checkoutSession.payment_intent?.id;

    if (!paymentIntentId) {
      return errAsync(
        new ExternalServiceError(
          "Stripe",
          "Missing payment_intent in checkout session",
          { context: { eventId: event.id } }
        )
      );
    }

    return checkWebhookIdempotency(this.db, event.id).andThen(
      (alreadyProcessed) => {
        if (alreadyProcessed) {
          logger.info({ eventId: event.id }, "Webhook already processed");
          return okAsync<void, AppError>(undefined);
        }

        // Attempt to record event atomically; null = duplicate (another request is processing)
        return recordWebhookEvent(this.db, event).andThen((recordedEvent) => {
          if (!recordedEvent) {
            logger.info(
              { eventId: event.id },
              "Duplicate webhook request detected, skipping"
            );
            return okAsync<void, AppError>(undefined);
          }

          return createDepositRecord(this.db, {
            userId,
            walletId,
            amountCents,
            stripeSessionId: checkoutSession.id,
            stripePaymentIntentId: paymentIntentId,
          }).andThen(({ deposit, tokenAmountWei }) =>
            fetchWalletForMint(this.db, walletId, deposit.id).andThen(
              (wallet) =>
                executeBlockchainMint(this.db, {
                  walletAddress: wallet.address,
                  tokenAmountWei,
                  depositId: deposit.id,
                }).andThen((txHash) => {
                  logger.info(
                    { txHash, depositId: deposit.id },
                    "Bridge Successful! Tokens minted."
                  );
                  return finalizeWebhookProcessing(this.db, {
                    networkId: wallet.networkId,
                    walletAddress: wallet.address,
                    txHash,
                    tokenAmountWei,
                    depositId: deposit.id,
                    eventId: event.id,
                  });
                })
            )
          );
        });
      }
    );
  }
}
