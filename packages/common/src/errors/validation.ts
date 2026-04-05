/**
 * validation.ts
 *
 * Input Validation errors.
 * Covers Zod validation failures and manual field-level checks.
 */

import { StatusCodes } from "http-status-codes";
import { AppError } from "./base";

export type FieldViolationDetail = {
  field: string;
  constraint: string;
  received?: unknown;
};

/**
 * Thrown when user-supplied input fails schema or business rule validation.
 * Wraps Zod violations or manual field-level checks.
 */
export class ValidationError extends AppError {
  readonly code = "VALIDATION_FAILED";
  readonly statusCode = StatusCodes.BAD_REQUEST;
  readonly domain = "validation" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;
  readonly violations: FieldViolationDetail[];

  constructor(
    violations: FieldViolationDetail[],
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    const summary = violations
      .map((v) => `${v.field}: ${v.constraint}`)
      .join("; ");
    super(`Validation failed — ${summary}.`, {
      ...options,
      context: { violations, ...options?.context },
    });
    this.violations = violations;
  }
}
