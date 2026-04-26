/**
 * base.ts
 *
 * Foundation of the error hierarchy. AppError is the abstract base class
 * that all application errors extend. Provides structured logging and
 * client-safe response generation.
 */

import { randomUUID } from "node:crypto";
import type { StatusCodes } from "http-status-codes";

export type ErrorSeverity = "low" | "medium" | "high" | "critical";

export type ErrorDomain =
  | "wallet"
  | "transaction"
  | "contract"
  | "defi"
  | "auth"
  | "user"
  | "deposit"
  | "withdrawal"
  | "compliance"
  | "market"
  | "infrastructure"
  | "validation";

export type FieldViolation = {
  field: string;
  message: string;
  received?: unknown;
};

/**
 * The single base class every application error extends.
 * Never instantiate directly — always use a concrete subclass.
 */
export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: StatusCodes;
  abstract readonly domain: ErrorDomain;
  abstract readonly severity: ErrorSeverity;

  /**
   * isOperational = true  → expected failure, respond and continue
   * isOperational = false → programmer bug, alert + restart
   */
  abstract readonly isOperational: boolean;

  readonly traceId: string;
  readonly timestamp: string;
  readonly context: Record<string, unknown>;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  override readonly cause?: Error;

  constructor(
    message: string,
    options: {
      context?: Record<string, unknown>;
      traceId?: string;
      cause?: unknown;
      retryable?: boolean;
      retryAfterMs?: number;
    } = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.traceId = options.traceId ?? randomUUID();
    this.timestamp = new Date().toISOString();
    this.context = options.context ?? {};
    this.retryable = options.retryable ?? false;
    this.retryAfterMs = options.retryAfterMs;
    if (options.cause instanceof Error) {
      this.cause = options.cause;
    } else if (options.cause !== undefined) {
      this.cause = new Error(String(options.cause));
    }

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Full internal details — for pino, never for clients.
   */
  toLog(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      domain: this.domain,
      severity: this.severity,
      isOperational: this.isOperational,
      statusCode: this.statusCode,
      message: this.message,
      traceId: this.traceId,
      timestamp: this.timestamp,
      retryable: this.retryable,
      retryAfterMs: this.retryAfterMs,
      context: this.context,
      stack: this.stack,
      cause: this.cause
        ? {
            name: this.cause.name,
            message: this.cause.message,
            stack: this.cause.stack,
          }
        : undefined,
    };
  }

  /**
   * Sanitized envelope — safe to send to any client.
   */
  toResponse(): ErrorEnvelope {
    return {
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        traceId: this.traceId,
        timestamp: this.timestamp,
        retryable: this.retryable,
        retryAfterMs: this.retryAfterMs,
      },
    };
  }
}

export type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    statusCode: number;
    traceId: string;
    timestamp: string;
    retryable: boolean;
    retryAfterMs?: number;
    details?: FieldViolation[];
  };
};
