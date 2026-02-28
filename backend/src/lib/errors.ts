// Error type definitions
export type AppError =
  | {
      type: "STRIPE_CARD_DECLINED";
      code: string;
      declineCode?: string;
      userMessage: string;
    }
  | {
      type: "BLOCKCHAIN_MINT_FAILED";
      txHash?: string;
      reason: string;
      userMessage: string;
    }
  | {
      type: "BLOCKCHAIN_CONFIRMATION_FAILED";
      txHash: string;
      attempts: number;
      userMessage: string;
    }
  | {
      type: "KYC_REQUIRED";
      currentStatus: string;
      requiredTier: string;
      userMessage: string;
    }
  | {
      type: "VALIDATION_FAILED";
      field: string;
      constraint: string;
      userMessage: string;
    }
  | {
      type: "RATE_LIMIT_EXCEEDED";
      limit: number;
      window: string;
      retryAfter: number;
      userMessage: string;
    }
  | {
      type: "INTERNAL_ERROR";
      reference: string;
      userMessage: string;
    };

// User-friendly error messages
// const ERROR_MESSAGES: Record<AppError["type"], string> = {
//   STRIPE_CARD_DECLINED:
//     "Your payment was declined. Please check your card details or try a different payment method.",
//   BLOCKCHAIN_MINT_FAILED:
//     "We're experiencing technical difficulties processing your deposit. Our team has been notified and will resolve this shortly.",
//   BLOCKCHAIN_CONFIRMATION_FAILED:
//     "Your deposit is taking longer than expected to confirm. Please check back in a few minutes.",
//   KYC_REQUIRED:
//     "Please complete identity verification to proceed with deposits over $1,000.",
//   VALIDATION_FAILED: "Please check your input and try again.",
//   RATE_LIMIT_EXCEEDED: "Too many requests. Please try again in a few minutes.",
//   INTERNAL_ERROR:
//     "Something went wrong. Please try again later or contact support if the issue persists.",
// };

// Generate unique error reference for tracking
// const generateReference = (): string =>
//   `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Extract source information from stack trace (BetterStack best practice)
// const getSourceInfo = (): { file?: string; line?: string } => {
//   try {
//     const stack = new Error().stack;
//     if (!stack) {
//       return {};
//     }
//     // Parse stack to get caller location (skip this function and createError)
//     const lines = stack.split("\n");
//     const callerLine = lines[3]; // 0: Error, 1: getSourceInfo, 2: createError, 3: caller
//     const match = callerLine?.match(/\((.+):(\d+):(\d+)\)$/);
//     if (match) {
//       return {
//         file: match[1].split("/").pop(), // Just filename
//         line: match[2],
//       };
//     }
//     return {};
//   } catch {
//     return {};
//   }
// };

// Error factory with automatic logging
// export function createError<T extends AppError["type"]>(
//   type: T,
//   context: Omit<Extract<AppError, { type: T }>, "type" | "userMessage">,
//   internalDetails?: Record<string, unknown>
// ): Result<never, AppError> {
//   const userMessage = ERROR_MESSAGES[type] || "An unexpected error occurred.";
//   const reference = generateReference();
//   const sourceInfo = getSourceInfo();
//   // Create the error object
//   const error = {
//     type,
//     ...context,
//     userMessage,
//   } as AppError;
//   // Log the error immediately (BetterStack best practice: include context)
//   logger.error({
//     event: {
//       type: `error.${type.toLowerCase()}`,
//       category: "error",
//       severity: getSeverity(type),
//       outcome: "failure",
//     },
//     error: {
//       type,
//       reference,
//       code: "code" in context ? context.code : undefined,
//       user_message: userMessage,
//       internal_details: sanitizeInternalDetails(internalDetails),
//     },
//     // BetterStack best practice: include source information
//     source: {
//       file: sourceInfo.file,
//       line: sourceInfo.line,
//     },
//   });
//   return err(error);
// }

// Helper to determine severity based on error type
// function getSeverity(type: AppError["type"]): string {
//   switch (type) {
//     case "BLOCKCHAIN_MINT_FAILED":
//     case "INTERNAL_ERROR":
//       return "error";
//     case "RATE_LIMIT_EXCEEDED":
//       return "warn";
//     default:
//       return "warn";
//   }
// }

// // Sanitize internal details before logging
// function sanitizeInternalDetails(
//   details?: Record<string, unknown>
// ): Record<string, unknown> | undefined {
//   if (!details) return;
//   const sensitiveKeys = [
//     "password",
//     "token",
//     "secret",
//     "privateKey",
//     "apiKey",
//     "creditCard",
//   ];
//   return Object.entries(details).reduce(
//     (acc, [key, value]) => {
//       if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
//         acc[key] = "[REDACTED]";
//       } else {
//         acc[key] = value;
//       }
//       return acc;
//     },
//     {} as Record<string, unknown>
//   );
// }

// // Success logging helper for consistency
// export function logSuccess<T>(
//   eventType: string,
//   data: T,
//   context: Record<string, unknown>
// ): Result<T, never> {
//   logger.info({
//     event: {
//       type: eventType,
//       category: "business",
//       severity: "info",
//       outcome: "success",
//     },
//     context: {
//       ...context,
//     },
//   });
//   return ok(data);
// }

// // Async wrapper for Promise-based functions
// export async function fromPromise<T>(
//   promise: Promise<T>,
//   errorFn: (e: unknown) => AppError
// ): Promise<Result<T, AppError>> {
//   try {
//     const result = await promise;
//     return ok(result);
//   } catch (e) {
//     return err(errorFn(e));
//   }
// }

// // Type guard for error checking
// export function isAppError(error: unknown): error is AppError {
//   return (
//     typeof error === "object" &&
//     error !== null &&
//     "type" in error &&
//     "userMessage" in error
//   );
// }
