/**
 * contract.ts
 *
 * Smart Contract errors.
 * Covers contract interaction, encoding failures, and pause states.
 */

import { StatusCodes } from "http-status-codes";
import { AppError } from "./base";

/**
 * Thrown when a contract address cannot be resolved or is not deployed
 * on the target chain.
 */
export class ContractNotFoundError extends AppError {
  readonly code = "CONTRACT_NOT_FOUND";
  readonly statusCode = StatusCodes.NOT_FOUND;
  readonly domain = "contract" as const;
  readonly severity = "medium" as const;
  readonly isOperational = true;

  constructor(
    address: string,
    chainId: number,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(`No contract found at '${address}' on chain ${chainId}.`, {
      ...options,
      context: { address, chainId, ...options?.context },
    });
  }
}

/**
 * Thrown when a contract call fails to encode (ABI mismatch, wrong types).
 */
export class ContractEncodingError extends AppError {
  readonly code = "CONTRACT_ENCODING_FAILED";
  readonly statusCode = StatusCodes.BAD_REQUEST;
  readonly domain = "contract" as const;
  readonly severity = "medium" as const;
  readonly isOperational = true;

  constructor(
    method: string,
    reason: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(`Failed to encode call to '${method}': ${reason}.`, {
      ...options,
      context: { method, reason, ...options?.context },
    });
  }
}

/**
 * Thrown when a contract call reverts with a known or unknown error selector.
 */
export class ContractCallRevertedError extends AppError {
  readonly code = "CONTRACT_CALL_REVERTED";
  readonly statusCode = StatusCodes.UNPROCESSABLE_ENTITY;
  readonly domain = "contract" as const;
  readonly severity = "medium" as const;
  readonly isOperational = true;

  constructor(
    method: string,
    revertData?: string,
    decodedReason?: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(
      decodedReason
        ? `Contract method '${method}' reverted: ${decodedReason}.`
        : `Contract method '${method}' reverted with unknown error.`,
      {
        ...options,
        context: { method, revertData, decodedReason, ...options?.context },
      }
    );
  }
}

/**
 * Thrown when a contract's pause mechanism is active.
 * Common in DeFi protocols during upgrades or emergencies.
 */
export class ContractPausedError extends AppError {
  readonly code = "CONTRACT_PAUSED";
  readonly statusCode = StatusCodes.SERVICE_UNAVAILABLE;
  readonly domain = "contract" as const;
  readonly severity = "high" as const;
  readonly isOperational = true;
  override readonly retryable = true;

  constructor(
    contractAddress: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(
      `Contract at '${contractAddress}' is currently paused. Operations are temporarily unavailable.`,
      {
        ...options,
        context: { contractAddress, ...options?.context },
      }
    );
  }
}

export type InsufficientAllowanceParams = {
  required: bigint;
  approved: bigint;
  tokenSymbol: string;
  spender: string;
};

/**
 * Thrown when a token allowance is insufficient for a contract to spend
 * on behalf of the user (ERC-20 approve/transferFrom pattern).
 */
export class InsufficientAllowanceError extends AppError {
  readonly code = "CONTRACT_INSUFFICIENT_ALLOWANCE";
  readonly statusCode = StatusCodes.UNPROCESSABLE_ENTITY;
  readonly domain = "contract" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(
    params: InsufficientAllowanceParams,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    const { required, approved, tokenSymbol, spender } = params;
    super(
      `Insufficient ${tokenSymbol} allowance for spender '${spender}'. Required: ${required}, approved: ${approved}.`,
      {
        ...options,
        context: {
          required: required.toString(),
          approved: approved.toString(),
          tokenSymbol,
          spender,
          ...options?.context,
        },
      }
    );
  }
}
