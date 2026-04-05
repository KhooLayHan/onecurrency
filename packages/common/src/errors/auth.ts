/**
 * auth.ts
 *
 * Authentication & Authorization errors.
 * Covers JWT issues, wallet-signature auth (SIWE), rate limits, and access control.
 */

import { StatusCodes } from "http-status-codes";
import { AppError } from "./base";

export type AuthErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_TOKEN_EXPIRED"
  | "AUTH_TOKEN_INVALID"
  | "AUTH_TOKEN_REVOKED"
  | "AUTH_SIGNATURE_INVALID"
  | "AUTH_NONCE_USED";

/**
 * Covers all authentication failures — JWT issues and wallet-signature auth (Sign-In With Ethereum).
 */
export class AuthenticationError extends AppError {
  readonly code: AuthErrorCode;
  readonly statusCode = StatusCodes.UNAUTHORIZED;
  readonly domain = "auth" as const;
  readonly severity = "medium" as const;
  readonly isOperational = true;

  constructor(
    code: AuthErrorCode,
    message: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(message, options);
    this.code = code;
  }
}

export type AuthzErrorCode =
  | "AUTHZ_INSUFFICIENT_ROLE"
  | "AUTHZ_RESOURCE_FORBIDDEN"
  | "AUTHZ_WALLET_NOT_OWNER";

/**
 * Covers all authorization failures — RBAC, wallet ownership, resource access.
 */
export class AuthorizationError extends AppError {
  readonly code: AuthzErrorCode;
  readonly statusCode = StatusCodes.FORBIDDEN;
  readonly domain = "auth" as const;
  readonly severity = "medium" as const;
  readonly isOperational = true;

  constructor(
    code: AuthzErrorCode,
    message: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(message, options);
    this.code = code;
  }
}

/**
 * Thrown when too many requests are made within a time window.
 * Covers both API rate limits and blockchain RPC rate limits.
 */
export class RateLimitError extends AppError {
  readonly code = "RATE_LIMIT_EXCEEDED";
  readonly statusCode = StatusCodes.TOO_MANY_REQUESTS;
  readonly domain = "auth" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;
  override readonly retryable = true;

  constructor(
    retryAfterMs: number,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super("Rate limit exceeded. Please wait before retrying.", {
      ...options,
      retryable: true,
      retryAfterMs,
    });
  }
}
