import { StatusCodes } from "http-status-codes";
import { AppError } from "./base";

export class WithdrawalNotFoundError extends AppError {
  readonly code = "WITHDRAWAL_NOT_FOUND";
  readonly statusCode = StatusCodes.NOT_FOUND;
  readonly domain = "withdrawal" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(
    identifier: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(`Withdrawal '${identifier}' was not found.`, {
      ...options,
      context: { identifier, ...options?.context },
    });
  }
}

export class WithdrawalKycRequiredError extends AppError {
  readonly code = "WITHDRAWAL_KYC_REQUIRED";
  readonly statusCode = StatusCodes.FORBIDDEN;
  readonly domain = "withdrawal" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(options?: ConstructorParameters<typeof AppError>[1]) {
    super(
      "Identity verification is required before cashing out.",
      options
    );
  }
}

export class WalletNotCustodialError extends AppError {
  readonly code = "WALLET_NOT_CUSTODIAL";
  readonly statusCode = StatusCodes.UNPROCESSABLE_ENTITY;
  readonly domain = "withdrawal" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(
    walletId: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(
      `Wallet '${walletId}' is not a custodial wallet and cannot be used for cash-out.`,
      { ...options, context: { walletId, ...options?.context } }
    );
  }
}
