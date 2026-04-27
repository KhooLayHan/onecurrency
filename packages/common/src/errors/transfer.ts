import { StatusCodes } from "http-status-codes";
import { AppError } from "./base";

export class TransferKycRequiredError extends AppError {
  readonly code = "TRANSFER_KYC_REQUIRED";
  readonly statusCode = StatusCodes.FORBIDDEN;
  readonly domain = "transaction" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(options?: ConstructorParameters<typeof AppError>[1]) {
    super("Identity verification is required before sending money.", options);
  }
}

export class RecipientNotFoundError extends AppError {
  readonly code = "RECIPIENT_NOT_FOUND";
  readonly statusCode = StatusCodes.NOT_FOUND;
  readonly domain = "user" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(
    email: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super("Recipient not found.", {
      ...options,
      context: { email, ...options?.context },
    });
  }
}

export class InsufficientGasError extends AppError {
  readonly code = "INSUFFICIENT_GAS";
  readonly statusCode = StatusCodes.UNPROCESSABLE_ENTITY;
  readonly domain = "transaction" as const;
  readonly severity = "high" as const;
  readonly isOperational = true;

  constructor(options?: ConstructorParameters<typeof AppError>[1]) {
    super("Unable to process transfer. Please try again shortly.", options);
  }
}

export class SelfTransferError extends AppError {
  readonly code = "SELF_TRANSFER";
  readonly statusCode = StatusCodes.UNPROCESSABLE_ENTITY;
  readonly domain = "transaction" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(options?: ConstructorParameters<typeof AppError>[1]) {
    super("You cannot send money to yourself.", options);
  }
}

export class TransferNotFoundError extends AppError {
  readonly code = "TRANSFER_NOT_FOUND";
  readonly statusCode = StatusCodes.NOT_FOUND;
  readonly domain = "transaction" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(
    identifier: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(`Transfer '${identifier}' was not found.`, {
      ...options,
      context: { identifier, ...options?.context },
    });
  }
}
