/**
 * market.ts
 *
 * Market Data & Oracle errors.
 * Covers price staleness, deviation between sources, and feed availability.
 */

import { StatusCodes } from "http-status-codes";
import { AppError } from "./base";

/**
 * Thrown when an oracle price feed is stale beyond the configured threshold.
 */
export class StalePriceError extends AppError {
  readonly code = "MARKET_PRICE_STALE";
  readonly statusCode = StatusCodes.SERVICE_UNAVAILABLE;
  readonly domain = "market" as const;
  readonly severity = "high" as const;
  readonly isOperational = true;
  override readonly retryable = true;

  constructor(
    feed: string,
    lastUpdatedAt: string,
    maxAgeSeconds: number,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(
      `Price feed '${feed}' is stale. Last update: ${lastUpdatedAt} (max age: ${maxAgeSeconds}s).`,
      {
        ...options,
        context: { feed, lastUpdatedAt, maxAgeSeconds, ...options?.context },
      }
    );
  }
}

export type PriceDeviationParams = {
  asset: string;
  sourceA: string;
  priceA: string;
  sourceB: string;
  priceB: string;
  deviationPercent: number;
};

/**
 * Thrown when a price deviates beyond an acceptable threshold between two sources,
 * suggesting manipulation or feed failure.
 */
export class PriceDeviationError extends AppError {
  readonly code = "MARKET_PRICE_DEVIATION";
  readonly statusCode = StatusCodes.SERVICE_UNAVAILABLE;
  readonly domain = "market" as const;
  readonly severity = "critical" as const;
  readonly isOperational = true;

  constructor(
    params: PriceDeviationParams,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    const { asset, sourceA, priceA, sourceB, priceB, deviationPercent } =
      params;
    super(
      `Price deviation for ${asset}: ${sourceA} reports ${priceA}, ${sourceB} reports ${priceB} (${deviationPercent.toFixed(2)}% deviation). Transaction halted.`,
      { ...options, context: { ...params, ...options?.context } }
    );
  }
}

/**
 * Thrown when a requested token pair has no price feed available.
 */
export class PriceFeedUnavailableError extends AppError {
  readonly code = "MARKET_PRICE_FEED_UNAVAILABLE";
  readonly statusCode = StatusCodes.SERVICE_UNAVAILABLE;
  readonly domain = "market" as const;
  readonly severity = "high" as const;
  readonly isOperational = true;
  override readonly retryable = true;

  constructor(
    pair: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(`No price feed available for pair '${pair}'.`, {
      ...options,
      context: { pair, ...options?.context },
    });
  }
}
