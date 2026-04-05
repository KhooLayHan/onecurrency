/**
 * infrastructure.ts
 *
 * Infrastructure (RPC, Chain, External Services) errors.
 * Covers RPC failures, chain reorganizations, and external service outages.
 */

import { StatusCodes } from "http-status-codes";
import { AppError } from "./base";

/**
 * Thrown when all configured RPC endpoints fail or are unreachable.
 */
export class RpcUnavailableError extends AppError {
  readonly code = "INFRA_RPC_UNAVAILABLE";
  readonly statusCode = StatusCodes.SERVICE_UNAVAILABLE;
  readonly domain = "infrastructure" as const;
  readonly severity = "critical" as const;
  readonly isOperational = true;
  override readonly retryable = true;

  constructor(
    chainId: number,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(`All RPC endpoints for chain ${chainId} are unavailable.`, {
      ...options,
      retryable: true,
      context: { chainId, ...options?.context },
    });
  }
}

/**
 * Thrown when the requested chain is not supported by the platform.
 */
export class UnsupportedChainError extends AppError {
  readonly code = "INFRA_CHAIN_UNSUPPORTED";
  readonly statusCode = StatusCodes.BAD_REQUEST;
  readonly domain = "infrastructure" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(
    chainId: number,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(`Chain ID ${chainId} is not supported.`, {
      ...options,
      context: { chainId, ...options?.context },
    });
  }
}

/**
 * Thrown when a chain reorganization invalidates a previously confirmed transaction.
 */
export class ChainReorgError extends AppError {
  readonly code = "INFRA_CHAIN_REORG";
  readonly statusCode = StatusCodes.CONFLICT;
  readonly domain = "infrastructure" as const;
  readonly severity = "high" as const;
  readonly isOperational = true;
  override readonly retryable = true;

  constructor(
    txHash: string,
    depth: number,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(
      `Chain reorganization detected (depth: ${depth} blocks). Transaction '${txHash}' may need to be resubmitted.`,
      {
        ...options,
        context: { txHash, depth, ...options?.context },
      }
    );
  }
}

/**
 * Thrown when an external service (bridge, CEX, custody provider) fails.
 */
export class ExternalServiceError extends AppError {
  readonly code: string;
  readonly statusCode = StatusCodes.BAD_GATEWAY;
  readonly domain = "infrastructure" as const;
  readonly severity = "high" as const;
  readonly isOperational = true;
  override readonly retryable = true;

  constructor(
    service: string,
    message: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(message, { ...options, retryable: true });
    this.code = `INFRA_${service.toUpperCase().replace(/\s+/g, "_")}_UNAVAILABLE`;
  }
}

/**
 * Thrown for unrecoverable programmer bugs.
 * isOperational = false → triggers alerts, consider process restart.
 */
export class InternalError extends AppError {
  readonly code = "INTERNAL_ERROR";
  readonly statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  readonly domain = "infrastructure" as const;
  readonly severity = "critical" as const;
  readonly isOperational = false;

  override toResponse(): import("./base").ErrorEnvelope {
    return {
      error: {
        code: this.code,
        message: "An unexpected error occurred. Our team has been notified.",
        statusCode: this.statusCode,
        traceId: this.traceId,
        timestamp: this.timestamp,
        retryable: false,
      },
    };
  }
}

/**
 * Normalizes any unknown thrown value into a typed AppError.
 * Used at the tryCatch / neverthrow boundary.
 */
export const toAppError = (e: unknown, traceId?: string): AppError => {
  if (e instanceof AppError) {
    return e;
  }
  return new InternalError(
    "An unhandled exception was caught at the system boundary.",
    { cause: e, traceId }
  );
};
