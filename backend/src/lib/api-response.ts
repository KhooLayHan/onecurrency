import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { AppError } from "@/common/errors/base";
import { InternalError } from "@/common/errors/infrastructure";
import {
  type FieldViolationDetail,
  ValidationError,
} from "@/common/errors/validation";
import { logger } from "./logger";

/**
 * Standardizes the JSON response for all API errors.
 * Safely hides internal error details in production.
 */
export function handleApiError(c: Context, error: unknown) {
  // const reqLogger = c.get("logger");

  let appError: AppError;

  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof z.ZodError) {
    const violations: FieldViolationDetail[] = error.issues.map((issue) => ({
      field: issue.path.join(".") || "_root",
      constraint: issue.message,
      received: "received" in issue ? issue.received : undefined,
    }));

    appError = new ValidationError(violations, { cause: error });
  } else {
    appError = new InternalError(
      "An unexpected error occurred at the API boundary.",
      { cause: error }
    );
  }

  logger.error(appError.toLog());
  return c.json(
    appError.toResponse(),
    appError.statusCode as ContentfulStatusCode
  );
}
