// backend/src/lib/api-response.ts
import { type Context } from "hono";
import { AppError } from "./errors";
import { z } from "zod";

/**
 * Standardizes the JSON response for all API errors.
 * Safely hides internal error details in production.
 */
export function handleApiError(c: Context, error: unknown) {
  const reqLogger = c.get("logger");

  // 1. If it's our custom AppError
  if (error instanceof AppError) {
    // Log with the provided context
    reqLogger.warn({ err: error, errContext: error.context, code: error.code }, error.message);
    
    return c.json({
      success: false,
      error: error.code,
      message: error.message, // Safe to expose to users
    }, error.statusCode as any);
  }

  // 2. If it's a Zod Validation Error (From oRPC or zValidator)
  if (error instanceof z.ZodError) {
    reqLogger.warn({ validationErrors: error.message }, "Validation Failed");
    return c.json({
      success: false,
      error: "VALIDATION_ERROR",
      message: "Invalid request parameters",
      details: error.format(),
    }, 400);
  }

  // 3. Fallback for unhandled exceptions (e.g., standard JS Errors)
  reqLogger.error({ err: error }, "Unhandled Internal Server Error");
  return c.json({
    success: false,
    error: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred. Our team has been notified.",
  }, 500);
}