// import { err, ok, type Result } from "neverthrow";
// import type { AppError } from "./errors";
// import { logger } from "./logger";

// // Context for deposit operations
// type DepositContext = {
//   depositId: string;
//   userId: string;
//   amountCents: number;
//   tokenAmount: string;
//   tokenUsdValue: string;
//   network: string;
//   startTime: number;
//   stripeDuration?: number;
//   blockchainSubmissionDuration?: number;
// };
// // Tokenization helper for correlation without exposure
// const tokenizeId = (id: string): string => {
//   // Use first 8 chars of SHA256 for reference
//   const crypto = require("crypto");
//   return crypto.createHash("sha256").update(id).digest("hex").slice(0, 8);
// };

// export const DepositLogger = {
//   // Stage 1: Deposit initiated
//   initiated(ctx: DepositContext): Result<DepositContext, AppError> {
//     logger.info({
//       event: {
//         type: "deposit.initiated",
//         category: "business",
//         severity: "info",
//         outcome: "success",
//       },
//       actor: {
//         user_id: ctx.userId,
//         user_type: "authenticated",
//       },
//       context: {
//         deposit_id: ctx.depositId,
//         deposit_token: tokenizeId(ctx.depositId), // For correlation
//         fiat_usd_cents: ctx.amountCents,
//         token_amount_native: ctx.tokenAmount,
//         token_amount_usd: ctx.tokenUsdValue,
//         network: ctx.network,
//         kyc_status: "verified", // Include at time of deposit
//       },
//     });
//     return ok(ctx);
//   },
//   // Stage 2: Stripe payment successful
//   stripePaymentSuccess(
//     ctx: DepositContext,
//     stripeData: {
//       paymentIntentId: string;
//       processingTimeMs: number;
//       riskLevel?: string;
//     }
//   ): Result<DepositContext, AppError> {
//     // Update context
//     ctx.stripeDuration = stripeData.processingTimeMs;
//     logger.info({
//       event: {
//         type: "deposit.stripe.success",
//         category: "business",
//         severity: "info",
//         outcome: "success",
//       },
//       actor: {
//         user_id: ctx.userId,
//       },
//       context: {
//         deposit_id: ctx.depositId,
//         stripe_payment_intent_id: stripeData.paymentIntentId,
//         processing_time_ms: stripeData.processingTimeMs,
//         risk_level: stripeData.riskLevel || "normal",
//       },
//     });
//     return ok(ctx);
//   },
//   // Stage 2b: Stripe payment failed
//   stripePaymentFailed(
//     ctx: DepositContext,
//     error: {
//       code: string;
//       declineCode?: string;
//       message: string;
//       processingTimeMs: number;
//     }
//   ): Result<never, AppError> {
//     logger.error({
//       event: {
//         type: "deposit.stripe.failed",
//         category: "business",
//         severity: "error",
//         outcome: "failure",
//       },
//       actor: {
//         user_id: ctx.userId,
//       },
//       context: {
//         deposit_id: ctx.depositId,
//         error_code: error.code,
//         decline_code: error.declineCode,
//         processing_time_ms: error.processingTimeMs,
//       },
//       error: {
//         type: "STRIPE_CARD_DECLINED",
//         code: error.code,
//         user_message:
//           "Your payment was declined. Please try a different payment method.",
//         internal_message: error.message,
//       },
//     });
//     return err({
//       type: "STRIPE_CARD_DECLINED",
//       code: error.code,
//       declineCode: error.declineCode,
//       userMessage:
//         "Your payment was declined. Please try a different payment method.",
//     });
//   },
//   // Stage 3: Blockchain transaction submitted
//   blockchainSubmitted(
//     ctx: DepositContext,
//     blockchainData: {
//       submissionTimeMs: number;
//       gasPriceGwei: number;
//       estimatedConfirmationTimeSec: number;
//     }
//   ): Result<DepositContext, AppError> {
//     ctx.blockchainSubmissionDuration = blockchainData.submissionTimeMs;
//     logger.info({
//       event: {
//         type: "deposit.blockchain.submitted",
//         category: "business",
//         severity: "info",
//         outcome: "success",
//       },
//       actor: {
//         user_id: ctx.userId,
//       },
//       context: {
//         deposit_id: ctx.depositId,
//         network: ctx.network,
//         gas_price_gwei: blockchainData.gasPriceGwei,
//         estimated_confirmation_sec: blockchainData.estimatedConfirmationTimeSec,
//       },
//     });
//     return ok(ctx);
//   },
//   // Stage 4: Blockchain transaction confirmed
//   blockchainConfirmed(
//     ctx: DepositContext,
//     confirmationData: {
//       confirmations: number;
//       confirmationDurationMs: number;
//       actualGasUsed?: number;
//     }
//   ): Result<DepositContext, AppError> {
//     const totalE2E = Date.now() - ctx.startTime;
//     // Canonical log line with all KPI data
//     logger.info({
//       event: {
//         type: "deposit.blockchain.confirmed",
//         category: "business",
//         severity: "info",
//         outcome: "success",
//       },
//       actor: {
//         user_id: ctx.userId,
//       },
//       context: {
//         deposit_id: ctx.depositId,
//         confirmations: confirmationData.confirmations,
//         network: ctx.network,
//       },
//       // KPI 3: Time-to-Finality (every deposit individually)
//       latency: {
//         total_e2e_ms: totalE2E,
//         stripe_processing_ms: ctx.stripeDuration || 0,
//         blockchain_submission_ms: ctx.blockchainSubmissionDuration || 0,
//         blockchain_confirmation_ms: confirmationData.confirmationDurationMs,
//         breakdown: {
//           payment: ctx.stripeDuration || 0,
//           submission: ctx.blockchainSubmissionDuration || 0,
//           confirmation: confirmationData.confirmationDurationMs,
//         },
//       },
//       // KPI 2: TVL data
//       value: {
//         fiat_usd_cents: ctx.amountCents,
//         token_amount_native: ctx.tokenAmount,
//         token_amount_usd: ctx.tokenUsdValue,
//       },
//     });
//     return ok(ctx);
//   },
//   // Stage 4b: Blockchain transaction failed
//   blockchainFailed(
//     ctx: DepositContext,
//     error: {
//       code: string;
//       message: string;
//       retryCount: number;
//       maxRetries: number;
//       stage: "submission" | "confirmation" | "execution";
//     }
//   ): Result<never, AppError> {
//     // CRITICAL - triggers email alert
//     logger.error({
//       event: {
//         type: "deposit.blockchain.failed",
//         category: "business",
//         severity: "error",
//         outcome: "failure",
//       },
//       actor: {
//         user_id: ctx.userId,
//       },
//       context: {
//         deposit_id: ctx.depositId,
//         failure_stage: error.stage,
//         error_code: error.code,
//         retry_count: error.retryCount,
//         max_retries: error.maxRetries,
//         manual_review_required: error.retryCount >= error.maxRetries,
//       },
//       error: {
//         type: "BLOCKCHAIN_MINT_FAILED",
//         code: error.code,
//         userMessage:
//           "We're experiencing technical difficulties. Our team has been notified.",
//         internal_message: error.message,
//       },
//     });
//     return err({
//       type: "BLOCKCHAIN_MINT_FAILED",
//       reason: error.message,
//       userMessage:
//         "We're experiencing technical difficulties. Our team has been notified.",
//     });
//   },
//   // Refund logging
//   refunded(
//     ctx: DepositContext,
//     refundData: {
//       refundAmountCents: number;
//       reason: string;
//       processedBy: string;
//     }
//   ): void {
//     logger.info({
//       event: {
//         type: "deposit.refunded",
//         category: "business",
//         severity: "warn",
//         outcome: "success",
//       },
//       actor: {
//         user_id: ctx.userId,
//         processed_by: refundData.processedBy,
//       },
//       context: {
//         deposit_id: ctx.depositId,
//         refund_amount_cents: refundData.refundAmountCents,
//         refund_reason: refundData.reason,
//       },
//     });
//   },
// };
// // Usage example with neverthrow pipeline
// export async function processDepositWorkflow(
//   depositData: unknown
// ): Promise<{ success: boolean; error?: string }> {
//   const startTime = Date.now();
//   const ctx: DepositContext = {
//     depositId: "dep_" + crypto.randomUUID(),
//     userId: "user_123",
//     amountCents: 100_000,
//     tokenAmount: "0.4975",
//     tokenUsdValue: "995.00",
//     network: "sepolia",
//     startTime,
//   };
//   // Neverthrow pipeline - each step logged automatically
//   const result = await DepositLogger.initiated(ctx)
//     .asyncAndThen(validateKYC)
//     .asyncAndThen(processStripePayment)
//     .andThen(DepositLogger.stripePaymentSuccess)
//     .asyncAndThen(submitBlockchainTx)
//     .andThen(DepositLogger.blockchainSubmitted)
//     .asyncAndThen(waitForConfirmation)
//     .andThen(DepositLogger.blockchainConfirmed);
//   if (result.isErr()) {
//     // Error already logged with context
//     return { success: false, error: result.error.userMessage };
//   }
//   return { success: true, deposit: result.value };
// }
// // Placeholder functions for the pipeline
// async function validateKYC(
//   ctx: DepositContext
// ): Promise<Result<DepositContext, AppError>> {
//   // Validation logic here
//   return ok(ctx);
// }
// async function processStripePayment(
//   ctx: DepositContext
// ): Promise<Result<DepositContext, AppError>> {
//   // Stripe processing logic here
//   return ok(ctx);
// }
// async function submitBlockchainTx(
//   ctx: DepositContext
// ): Promise<Result<DepositContext, AppError>> {
//   // Blockchain submission logic here
//   return ok(ctx);
// }
// async function waitForConfirmation(ctx: DepositContext): Promise<
//   Result<
//     DepositContext & {
//       confirmations: number;
//       confirmationDurationMs: number;
//     },
//     AppError
//   >
// > {
//   // Wait for blockchain confirmation
//   return ok({
//     ...ctx,
//     confirmations: 12,
//     confirmationDurationMs: 77_000,
//   });
// }
