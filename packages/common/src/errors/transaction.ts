/**
 * transaction.ts
 *
 * Transaction & Gas errors.
 * Covers transaction lifecycle from submission through confirmation.
 */

import { StatusCodes } from "http-status-codes";
import { AppError } from "./base";

/**
 * Thrown when a transaction hash/ID is not found on-chain or in mempool.
 */
export class TransactionNotFoundError extends AppError {
  readonly code = "TX_NOT_FOUND";
  readonly statusCode = StatusCodes.NOT_FOUND;
  readonly domain = "transaction" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(
    txHash: string,
    chainId?: number,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(
      `Transaction '${txHash}' was not found${chainId ? ` on chain ${chainId}` : ""}.`,
      {
        ...options,
        context: { txHash, chainId, ...options?.context },
      }
    );
  }
}

/**
 * Thrown when a transaction is reverted by the EVM or equivalent runtime.
 * Includes the revert reason when available.
 */
export class TransactionRevertedError extends AppError {
  readonly code = "TX_REVERTED";
  readonly statusCode = StatusCodes.UNPROCESSABLE_ENTITY;
  readonly domain = "transaction" as const;
  readonly severity = "medium" as const;
  readonly isOperational = true;

  constructor(
    txHash: string,
    revertReason?: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(
      revertReason
        ? `Transaction '${txHash}' reverted: ${revertReason}.`
        : `Transaction '${txHash}' reverted without a reason string.`,
      { ...options, context: { txHash, revertReason, ...options?.context } }
    );
  }
}

/**
 * Thrown when a transaction is dropped from the mempool or never mined
 * within the expected confirmation window.
 */
export class TransactionDroppedError extends AppError {
  readonly code = "TX_DROPPED";
  readonly statusCode = StatusCodes.REQUEST_TIMEOUT;
  readonly domain = "transaction" as const;
  readonly severity = "medium" as const;
  readonly isOperational = true;
  override readonly retryable = true;

  constructor(
    txHash: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(
      `Transaction '${txHash}' was dropped from the mempool and will not be mined.`,
      {
        ...options,
        context: { txHash, ...options?.context },
      }
    );
  }
}

/**
 * Thrown when gas estimation fails because the transaction would revert,
 * or when the estimated gas exceeds the block gas limit.
 */
export class GasEstimationError extends AppError {
  readonly code = "TX_GAS_ESTIMATION_FAILED";
  readonly statusCode = StatusCodes.UNPROCESSABLE_ENTITY;
  readonly domain = "transaction" as const;
  readonly severity = "medium" as const;
  readonly isOperational = true;

  constructor(
    reason: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(`Gas estimation failed: ${reason}.`, {
      ...options,
      context: { reason, ...options?.context },
    });
  }
}

/**
 * Thrown when the wallet has insufficient native token to cover gas fees.
 * Distinct from InsufficientBalanceError, which covers the transfer amount.
 */
export class InsufficientGasError extends AppError {
  readonly code = "TX_INSUFFICIENT_GAS";
  readonly statusCode = StatusCodes.UNPROCESSABLE_ENTITY;
  readonly domain = "transaction" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(
    required: bigint,
    available: bigint,
    nativeSymbol: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(
      `Insufficient ${nativeSymbol} for gas. Estimated: ${required}, available: ${available}.`,
      {
        ...options,
        context: {
          required: required.toString(),
          available: available.toString(),
          nativeSymbol,
          ...options?.context,
        },
      }
    );
  }
}

/**
 * Thrown when a submitted nonce is stale (too low) or has a gap (too high).
 */
export class NonceMismatchError extends AppError {
  readonly code = "TX_NONCE_MISMATCH";
  readonly statusCode = StatusCodes.UNPROCESSABLE_ENTITY;
  readonly domain = "transaction" as const;
  readonly severity = "medium" as const;
  readonly isOperational = true;

  constructor(
    expected: number,
    received: number,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(`Nonce mismatch. Expected: ${expected}, received: ${received}.`, {
      ...options,
      context: { expected, received, ...options?.context },
    });
  }
}

export type SpendLimitParams = {
  limitType: "per_transaction" | "daily" | "weekly";
  limit: string;
  attempted: string;
  currency: string;
};

/**
 * Thrown when a transaction exceeds the configured spend limit
 * (per-transaction, daily, or weekly).
 */
export class SpendLimitExceededError extends AppError {
  readonly code = "TX_SPEND_LIMIT_EXCEEDED";
  readonly statusCode = StatusCodes.UNPROCESSABLE_ENTITY;
  readonly domain = "transaction" as const;
  readonly severity = "medium" as const;
  readonly isOperational = true;

  constructor(
    params: SpendLimitParams,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    const { limitType, limit, attempted, currency } = params;
    super(
      `${limitType.replace("_", " ")} spend limit of ${limit} ${currency} exceeded. Attempted: ${attempted} ${currency}.`,
      { ...options, context: { ...params, ...options?.context } }
    );
  }
}

/**
 * Thrown when a duplicate transaction is detected (same nonce + same data).
 */
export class DuplicateTransactionError extends AppError {
  readonly code = "TX_DUPLICATE";
  readonly statusCode = StatusCodes.CONFLICT;
  readonly domain = "transaction" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(
    txHash: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(`Transaction '${txHash}' has already been submitted.`, {
      ...options,
      context: { txHash, ...options?.context },
    });
  }
}
