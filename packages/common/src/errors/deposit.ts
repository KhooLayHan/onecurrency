import { StatusCodes } from "http-status-codes";
import { AppError } from "./base";

/**
 * Thrown when a deposit cannot be found by ID or transaction hash.
 */
export class DepositNotFoundError extends AppError {
  readonly code = "DEPOSIT_NOT_FOUND";
  readonly statusCode = StatusCodes.NOT_FOUND;
  readonly domain = "deposit" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(
    identifier: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(`Deposit '${identifier}' was not found.`, {
      ...options,
      context: { identifier, ...options?.context },
    });
  }
}

/**
 * Thrown when a user attempts a deposit without completing KYC verification.
 */
export class DepositKycRequiredError extends AppError {
  readonly code = "DEPOSIT_KYC_REQUIRED";
  readonly statusCode = StatusCodes.FORBIDDEN;
  readonly domain = "deposit" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(options?: ConstructorParameters<typeof AppError>[1]) {
    super(
      "Identity verification is required before making a deposit.",
      options
    );
  }
}
