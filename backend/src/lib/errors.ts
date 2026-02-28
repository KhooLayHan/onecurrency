// import { err, ok, type Result } from "neverthrow";
// import { logger } from "./logger";

// export type ErrorSeverity = "warn" | "error" | "fatal";

// export type AppError = {
//   type: string;
//   code: string;
//   userMessage: string;
//   internalMessage: string;
//   severity: ErrorSeverity;
//   context?: Record<string, unknown>;
// };

// export const CRITICAL_EVENTS = [
//   "system.startup",
//   "system.crash",
//   "system.shutdown",
//   "db.connection.failed",
//   "deposit.blockchain.failed",
//   "deposit.stripe.failed",
//   "encryption.key.error",
//   "webhook.processing.failed",
//   "auth.system.error",
//   "rate.limit.hit",
// ] as const;

// export type CriticalEventType = (typeof CRITICAL_EVENTS)[number];

// type CreateErrorOptions = {
//   type: string;
//   code: string;
//   userMessage: string;
//   internalMessage: string;
//   severity?: ErrorSeverity;
//   context?: Record<string, unknown>;
// };

// export function createError(options: CreateErrorOptions): AppError {
//   return {
//     type: options.type,
//     code: options.code,
//     userMessage: options.userMessage,
//     internalMessage: options.internalMessage,
//     // severity: options.severity ?? "error",
//     // context: options.context,
//   };
// }

// export function logError(
//   error: AppError,
//   correlationId?: string,
//   actor?: { user_id?: string; user_type?: string }
// ): void {
//   const isCritical = CRITICAL_EVENTS.includes(error.type as CriticalEventType);

//   const logData = {
//     event: {
//       type: error.type,
//       category: "system" as const,
//       severity: isCritical ? ("error" as const) : error.severity,
//       outcome: "failure" as const,
//       correlation_id: correlationId,
//     },
//     actor: actor || { user_type: "system" as const },
//     error: {
//       type: error.type,
//       code: error.code,
//       user_message: error.userMessage,
//       internal_message: error.internalMessage,
//     },
//     context: error.context,
//   };

//   if (error.severity === "fatal" || isCritical) {
//     logger.fatal(error.internalMessage, logData);
//   } else if (error.severity === "error") {
//     logger.error(error.internalMessage, logData);
//   } else {
//     logger.warn(error.internalMessage, logData);
//   }
// }

// type CreateLoggedErrorOptions = {
//   type: string;
//   code: string;
//   userMessage: string;
//   internalMessage: string;
//   severity?: ErrorSeverity;
//   context?: Record<string, unknown>;
//   correlationId?: string;
//   actor?: { user_id?: string; user_type?: string };
// };

// export function createLoggedError(
//   options: CreateLoggedErrorOptions
// ): Result<never, AppError> {
//   const error = createError(options);
//   logError(error, options.correlationId, options.actor);
//   return err(error);
// }

// type OkWithLogOptions = {
//   value: unknown;
//   eventType: string;
//   correlationId?: string;
//   actor?: { user_id?: string; user_type?: string };
//   context?: Record<string, unknown>;
// };

// export function okWithLog(options: OkWithLogOptions): Result<unknown, never> {
//   logger.info(`Operation succeeded: ${options.eventType}`, {
//     event: {
//       type: options.eventType,
//       category: "business" as const,
//       severity: "info" as const,
//       outcome: "success" as const,
//       correlation_id: options.correlationId,
//     },
//     actor: options.actor || { user_type: "system" as const },
//     context: options.context,
//   });
//   return ok(options.value);
// }

// type TryCatchOptions = {
//   fn: () => unknown;
//   errorType: string;
//   errorCode: string;
//   userMessage: string;
//   correlationId?: string;
//   actor?: { user_id?: string; user_type?: string };
// };

// export function tryCatch(options: TryCatchOptions): Result<unknown, AppError> {
//   try {
//     const result = options.fn();
//     return ok(result);
//   } catch (error) {
//     const internalMessage =
//       error instanceof Error ? error.message : String(error);
//     const appError = createError({
//       type: options.errorType,
//       code: options.errorCode,
//       userMessage: options.userMessage,
//       internalMessage,
//       severity: "error",
//       context: {
//         original_error: error instanceof Error ? error.name : "Unknown",
//       },
//     });
//     logError(appError, options.correlationId, options.actor);
//     return err(appError);
//   }
// }

// type AsyncTryCatchOptions = {
//   fn: () => Promise<unknown>;
//   errorType: string;
//   errorCode: string;
//   userMessage: string;
//   correlationId?: string;
//   actor?: { user_id?: string; user_type?: string };
// };

// export async function asyncTryCatch(
//   options: AsyncTryCatchOptions
// ): Promise<Result<unknown, AppError>> {
//   try {
//     const result = await options.fn();
//     return ok(result);
//   } catch (error) {
//     const internalMessage =
//       error instanceof Error ? error.message : String(error);
//     const appError = createError({
//       type: options.errorType,
//       code: options.errorCode,
//       userMessage: options.userMessage,
//       internalMessage,
//       severity: "error",
//       context: {
//         original_error: error instanceof Error ? error.name : "Unknown",
//       },
//     });
//     logError(appError, options.correlationId, options.actor);
//     return err(appError);
//   }
// }

// export function logSystemStartup(): void {
//   logger.info("System startup completed", {
//     event: {
//       type: "system.startup" as const,
//       category: "system" as const,
//       severity: "info" as const,
//       outcome: "success" as const,
//     },
//     actor: { user_type: "system" as const },
//   });
// }

// export function logSystemShutdown(signal: string): void {
//   logger.warn(`System shutdown initiated via ${signal}`, {
//     event: {
//       type: "system.shutdown" as const,
//       category: "system" as const,
//       severity: "warn" as const,
//       outcome: "success" as const,
//     },
//     actor: { user_type: "system" as const },
//     context: { signal },
//   });
// }

// export function logSystemCrash(error: unknown): void {
//   const message = error instanceof Error ? error.message : String(error);
//   logger.fatal(`System crash: ${message}`, {
//     event: {
//       type: "system.crash" as const,
//       category: "system" as const,
//       severity: "fatal" as const,
//       outcome: "failure" as const,
//     },
//     actor: { user_type: "system" as const },
//     error: {
//       type: "system.crash",
//       code: "UNHANDLED_EXCEPTION",
//       user_message: "An unexpected error occurred. Please try again later.",
//       internal_message: message,
//     },
//   });
// }
