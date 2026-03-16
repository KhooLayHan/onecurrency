import type { Context } from "hono";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { AppError } from "./errors";
import { logger } from "./logger";

/**
 * Standardizes the JSON response for all API errors.
 * Safely hides internal error details in production.
 */
export function handleApiError(c: Context, error: unknown) {
  // const reqLogger = c.get("logger");

  // 1. If it's our custom AppError
  if (error instanceof AppError) {
    // Log with the provided context
    logger.warn(
      { err: error, errContext: error.context, code: error.code },
      error.message
    );

    return c.json(
      {
        success: false,
        error: error.code,
        message: error.message, // Safe to expose to users
      },
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }

  // 2. If it's a Zod Validation Error (From oRPC or zValidator)
  if (error instanceof z.ZodError) {
    logger.warn({ validationErrors: error.message }, "Validation Failed");
    return c.json(
      {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Invalid request parameters",
        details: z.treeifyError(error),
      },
      StatusCodes.BAD_REQUEST
    );
  }

  // 3. Fallback for unhandled exceptions (e.g., standard JS Errors)
  logger.error({ err: error }, "Unhandled Internal Server Error");
  return c.json(
    {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred. Our team has been notified.",
    },
    StatusCodes.INTERNAL_SERVER_ERROR
  );
}
