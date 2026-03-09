import { StatusCodes } from "http-status-codes";

// 1. Define every possible Error Code in the system
// This gives you strict TypeScript autocomplete across your entire codebase.
export type ErrorCode =
  // Blockchain
  | "BLOCKCHAIN_NETWORK_ERROR"
  | "TRANSACTION_REVERTED"
  | "INVALID_WALLET_ADDRESS"
  // Business / Compliance
  | "KYC_REQUIRED"
  | "USER_BLACKLISTED"
  | "DEPOSIT_LIMIT_EXCEEDED"
  // External Services (Stripe)
  | "STRIPE_API_ERROR"
  | "WEBHOOK_SIGNATURE_INVALID"
  // Standard API
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INTERNAL_SERVER_ERROR"
  | "VALIDATION_ERROR";

// 2. The Base Application Error Class
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly context?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: StatusCodes,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.context = context ?? {};

    // Capture the stack trace for debugging (excluding the constructor call)
    Error.captureStackTrace(this, this.constructor);
  }
}

// 3. Domain-Specific Error Factories (Makes code cleaner to read)

export class BlockchainError extends AppError {
  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = StatusCodes.BAD_GATEWAY, // Default to 502
    context?: Record<string, unknown>
  ) {
    super(code, message, statusCode, context); // 502 Bad Gateway is accurate for RPC failures
  }
}

export class BusinessRuleError extends AppError {
  constructor(
    code: ErrorCode,
    message: string,
    context?: Record<string, unknown>
  ) {
    super(code, message, StatusCodes.BAD_REQUEST, context); // 400 Bad Request
  }
}

export class ExternalServiceError extends AppError {
  constructor(
    code: ErrorCode,
    message: string,
    context?: Record<string, unknown>
  ) {
    super(code, message, StatusCodes.BAD_GATEWAY, context);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super("NOT_FOUND", `${resource} not found`, StatusCodes.NOT_FOUND);
  }
}
