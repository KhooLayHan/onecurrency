/**
 * defi.ts
 *
 * DeFi (Swaps, Liquidity, Yield) errors.
 * Covers slippage, liquidity, routing, MEV detection, and liquidation risk.
 */

import { StatusCodes } from "http-status-codes";
import { AppError } from "./base";

export type SlippageParams = {
  expectedOut: bigint;
  actualOut: bigint;
  tokenSymbol: string;
  slippageBps: number;
};

/**
 * Thrown when a swap's actual output falls below the user's configured
 * minimum (slippage tolerance exceeded).
 */
export class SlippageExceededError extends AppError {
  readonly code = "DEFI_SLIPPAGE_EXCEEDED";
  readonly statusCode = StatusCodes.UNPROCESSABLE_ENTITY;
  readonly domain = "defi" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(
    params: SlippageParams,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    const { expectedOut, actualOut, tokenSymbol, slippageBps } = params;
    super(
      `Swap slippage exceeded. Expected minimum: ${expectedOut} ${tokenSymbol}, received: ${actualOut} ${tokenSymbol} (tolerance: ${slippageBps / 100}%).`,
      {
        ...options,
        context: {
          expectedOut: expectedOut.toString(),
          actualOut: actualOut.toString(),
          tokenSymbol,
          slippageBps,
          ...options?.context,
        },
      }
    );
  }
}

/**
 * Thrown when a swap quote expires before the transaction is submitted.
 */
export class QuoteExpiredError extends AppError {
  readonly code = "DEFI_QUOTE_EXPIRED";
  readonly statusCode = StatusCodes.GONE;
  readonly domain = "defi" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(
    quoteId: string,
    expiredAt: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(
      `Swap quote '${quoteId}' expired at ${expiredAt}. Please request a fresh quote.`,
      {
        ...options,
        context: { quoteId, expiredAt, ...options?.context },
      }
    );
  }
}

/**
 * Thrown when a liquidity pool has insufficient reserves to fill the swap.
 */
export class InsufficientLiquidityError extends AppError {
  readonly code = "DEFI_INSUFFICIENT_LIQUIDITY";
  readonly statusCode = StatusCodes.UNPROCESSABLE_ENTITY;
  readonly domain = "defi" as const;
  readonly severity = "medium" as const;
  readonly isOperational = true;

  constructor(
    poolAddress: string,
    tokenIn: string,
    tokenOut: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(
      `Insufficient liquidity in pool '${poolAddress}' for ${tokenIn} → ${tokenOut} swap.`,
      {
        ...options,
        context: { poolAddress, tokenIn, tokenOut, ...options?.context },
      }
    );
  }
}

/**
 * Thrown when a DEX route cannot be found between two tokens.
 */
export class NoRouteFoundError extends AppError {
  readonly code = "DEFI_NO_ROUTE_FOUND";
  readonly statusCode = StatusCodes.UNPROCESSABLE_ENTITY;
  readonly domain = "defi" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(
    tokenIn: string,
    tokenOut: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(`No swap route found from ${tokenIn} to ${tokenOut}.`, {
      ...options,
      context: { tokenIn, tokenOut, ...options?.context },
    });
  }
}

/**
 * Thrown when a MEV sandwich attack or front-run is detected.
 */
export class MevDetectedError extends AppError {
  readonly code = "DEFI_MEV_DETECTED";
  readonly statusCode = StatusCodes.UNPROCESSABLE_ENTITY;
  readonly domain = "defi" as const;
  readonly severity = "high" as const;
  readonly isOperational = true;

  constructor(
    txHash: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(
      `Potential MEV/sandwich attack detected for transaction '${txHash}'. Transaction aborted for user protection.`,
      {
        ...options,
        context: { txHash, ...options?.context },
      }
    );
  }
}

/**
 * Thrown when a position would be liquidated at the requested action.
 */
export class LiquidationRiskError extends AppError {
  readonly code = "DEFI_LIQUIDATION_RISK";
  readonly statusCode = StatusCodes.UNPROCESSABLE_ENTITY;
  readonly domain = "defi" as const;
  readonly severity = "high" as const;
  readonly isOperational = true;

  constructor(
    positionId: string,
    healthFactor: number,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(
      `Position '${positionId}' is at liquidation risk. Health factor: ${healthFactor.toFixed(4)} (minimum: 1.0).`,
      { ...options, context: { positionId, healthFactor, ...options?.context } }
    );
  }
}

/**
 * Thrown when the lock period for staked or vested funds has not yet elapsed.
 */
export class LockPeriodActiveError extends AppError {
  readonly code = "DEFI_LOCK_PERIOD_ACTIVE";
  readonly statusCode = StatusCodes.UNPROCESSABLE_ENTITY;
  readonly domain = "defi" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(
    unlocksAt: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(`Funds are locked until ${unlocksAt}.`, {
      ...options,
      context: { unlocksAt, ...options?.context },
    });
  }
}
