/**
 * errors.ts
 *
 * Production-ready error hierarchy for a blockchain-finance application.
 * Built on neverthrow's ResultAsync/Result pattern.
 *
 * Domain coverage:
 *   - Wallet & Key Management
 *   - Transactions & Gas
 *   - Smart Contracts
 *   - DeFi (swaps, liquidity, yield)
 *   - Authentication & Authorization
 *   - Compliance & KYC/AML
 *   - Market Data & Oracles
 *   - Infrastructure & RPC
 */

import { randomUUID } from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// FOUNDATION
// ─────────────────────────────────────────────────────────────────────────────

export type ErrorSeverity = "low" | "medium" | "high" | "critical";
export type ErrorDomain =
  | "wallet"
  | "transaction"
  | "contract"
  | "defi"
  | "auth"
  | "compliance"
  | "market"
  | "infrastructure";

export type FieldViolation = {
  field: string;
  message: string;
  received?: unknown;
}

/**
 * The single base class every application error extends.
 * Never instantiate directly — always use a concrete subclass.
 */
const DEFAULT_RETRY_DURATION: number = 5;

export abstract class AppError extends Error {

  abstract readonly code: string;
  abstract readonly statusCode: number;
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
  readonly retryAfterMs?: number | undefined;
  override readonly cause?: Error | undefined;

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
    this.retryAfterMs = options.retryAfterMs ?? DEFAULT_RETRY_DURATION;

    this.cause = options.cause instanceof Error
      ? options.cause
      : options.cause !== undefined
        ? new Error(String(options.cause))
        : undefined;

    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }

  /** Full internal details — for pino, never for clients. */
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
        ? { name: this.cause.name, message: this.cause.message, stack: this.cause.stack }
        : undefined,
    };
  }

  /** Sanitized envelope — safe to send to any client. */
  toResponse(): ErrorEnvelope {
    return {
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        traceId: this.traceId,
        timestamp: this.timestamp,
        retryable: this.retryable,
        retryAfterMs: this.retryAfterMs ?? DEFAULT_RETRY_DURATION,
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
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. WALLET & KEY MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thrown when a wallet address fails checksum or format validation.
 * Covers EVM (0x…), Solana (base58), and other chain formats.
 */
export class InvalidAddressError extends AppError {
  readonly code = "WALLET_ADDRESS_INVALID";
  readonly statusCode = 400;
  readonly domain = "wallet" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(
    address: string,
    chainId?: number,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(
      `Address '${address}' is not a valid ${chainId ? `chain-${chainId}` : "blockchain"} address.`,
      { ...options, context: { address, chainId, ...options?.context } }
    );
  }
}

/**
 * Thrown when a wallet has insufficient native token balance to cover
 * the transfer amount, ignoring gas (use InsufficientGasError for gas).
 */
export class InsufficientBalanceError extends AppError {
  readonly code = "WALLET_INSUFFICIENT_BALANCE";
  readonly statusCode = 422;
  readonly domain = "wallet" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(
    required: bigint,
    available: bigint,
    tokenSymbol: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(
      `Insufficient ${tokenSymbol} balance. Required: ${required}, available: ${available}.`,
      { ...options, context: { required: required.toString(), available: available.toString(), tokenSymbol, ...options?.context } }
    );
  }
}

/**
 * Thrown when a wallet cannot be found by address or internal ID.
 */
export class WalletNotFoundError extends AppError {
  readonly code = "WALLET_NOT_FOUND";
  readonly statusCode = 404;
  readonly domain = "wallet" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(identifier: string, options?: ConstructorParameters<typeof AppError>[1]) {
    super(`Wallet '${identifier}' was not found.`, {
      ...options, context: { identifier, ...options?.context },
    });
  }
}

/**
 * Thrown when wallet signing fails — wrong key, locked keystore, or HSM error.
 */
export class WalletSigningError extends AppError {
  readonly code = "WALLET_SIGNING_FAILED";
  readonly statusCode = 500;
  readonly domain = "wallet" as const;
  readonly severity = "high" as const;
  readonly isOperational = true;

  constructor(reason: string, options?: ConstructorParameters<typeof AppError>[1]) {
    super(`Wallet signing failed: ${reason}.`, {
      ...options, context: { reason, ...options?.context },
    });
  }
}

/**
 * Thrown when a private key format is invalid or cannot be imported.
 */
export class InvalidPrivateKeyError extends AppError {
  readonly code = "WALLET_PRIVATE_KEY_INVALID";
  readonly statusCode = 400;
  readonly domain = "wallet" as const;
  readonly severity = "high" as const;
  readonly isOperational = true;

  constructor(options?: ConstructorParameters<typeof AppError>[1]) {
    // Never include the key itself in the message or context
    super("The provided private key is malformed or uses an unsupported format.", options);
  }
}

/**
 * Thrown when the derivation path for HD wallet key derivation is invalid.
 */
export class InvalidDerivationPathError extends AppError {
  readonly code = "WALLET_DERIVATION_PATH_INVALID";
  readonly statusCode = 400;
  readonly domain = "wallet" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(path: string, options?: ConstructorParameters<typeof AppError>[1]) {
    super(`Derivation path '${path}' is not a valid BIP-44 path.`, {
      ...options, context: { path, ...options?.context },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thrown when a transaction hash/ID is not found on-chain or in mempool.
 */
export class TransactionNotFoundError extends AppError {
  readonly code = "TX_NOT_FOUND";
  readonly statusCode = 404;
  readonly domain = "transaction" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(txHash: string, chainId?: number, options?: ConstructorParameters<typeof AppError>[1]) {
    super(`Transaction '${txHash}' was not found${chainId ? ` on chain ${chainId}` : ""}.`, {
      ...options, context: { txHash, chainId, ...options?.context },
    });
  }
}

/**
 * Thrown when a transaction is reverted by the EVM or equivalent runtime.
 * Includes the revert reason when available.
 */
export class TransactionRevertedError extends AppError {
  readonly code = "TX_REVERTED";
  readonly statusCode = 422;
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
  readonly statusCode = 408;
  readonly domain = "transaction" as const;
  readonly severity = "medium" as const;
  readonly isOperational = true;
  override readonly retryable = true;

  constructor(txHash: string, options?: ConstructorParameters<typeof AppError>[1]) {
    super(`Transaction '${txHash}' was dropped from the mempool and will not be mined.`, {
      ...options, context: { txHash, ...options?.context },
    });
  }
}

/**
 * Thrown when gas estimation fails because the transaction would revert,
 * or when the estimated gas exceeds the block gas limit.
 */
export class GasEstimationError extends AppError {
  readonly code = "TX_GAS_ESTIMATION_FAILED";
  readonly statusCode = 422;
  readonly domain = "transaction" as const;
  readonly severity = "medium" as const;
  readonly isOperational = true;

  constructor(reason: string, options?: ConstructorParameters<typeof AppError>[1]) {
    super(`Gas estimation failed: ${reason}.`, {
      ...options, context: { reason, ...options?.context },
    });
  }
}

/**
 * Thrown when the wallet has insufficient native token to cover gas fees.
 * Distinct from InsufficientBalanceError, which covers the transfer amount.
 */
export class InsufficientGasError extends AppError {
  readonly code = "TX_INSUFFICIENT_GAS";
  readonly statusCode = 422;
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
      { ...options, context: { required: required.toString(), available: available.toString(), nativeSymbol, ...options?.context } }
    );
  }
}

/**
 * Thrown when a submitted nonce is stale (too low) or has a gap (too high).
 */
export class NonceMismatchError extends AppError {
  readonly code = "TX_NONCE_MISMATCH";
  readonly statusCode = 422;
  readonly domain = "transaction" as const;
  readonly severity = "medium" as const;
  readonly isOperational = true;

  constructor(
    expected: number,
    received: number,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(`Nonce mismatch. Expected: ${expected}, received: ${received}.`, {
      ...options, context: { expected, received, ...options?.context },
    });
  }
}

/**
 * Thrown when a transaction exceeds the configured spend limit
 * (per-transaction, daily, or weekly).
 */
export class SpendLimitExceededError extends AppError {
  readonly code = "TX_SPEND_LIMIT_EXCEEDED";
  readonly statusCode = 422;
  readonly domain = "transaction" as const;
  readonly severity = "medium" as const;
  readonly isOperational = true;

  constructor(
    limitType: "per_transaction" | "daily" | "weekly",
    limit: string,
    attempted: string,
    currency: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(
      `${limitType.replace("_", " ")} spend limit of ${limit} ${currency} exceeded. Attempted: ${attempted} ${currency}.`,
      { ...options, context: { limitType, limit, attempted, currency, ...options?.context } }
    );
  }
}

/**
 * Thrown when a duplicate transaction is detected (same nonce + same data).
 */
export class DuplicateTransactionError extends AppError {
  readonly code = "TX_DUPLICATE";
  readonly statusCode = 409;
  readonly domain = "transaction" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(txHash: string, options?: ConstructorParameters<typeof AppError>[1]) {
    super(`Transaction '${txHash}' has already been submitted.`, {
      ...options, context: { txHash, ...options?.context },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SMART CONTRACTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thrown when a contract address cannot be resolved or is not deployed
 * on the target chain.
 */
export class ContractNotFoundError extends AppError {
  readonly code = "CONTRACT_NOT_FOUND";
  readonly statusCode = 404;
  readonly domain = "contract" as const;
  readonly severity = "medium" as const;
  readonly isOperational = true;

  constructor(address: string, chainId: number, options?: ConstructorParameters<typeof AppError>[1]) {
    super(`No contract found at '${address}' on chain ${chainId}.`, {
      ...options, context: { address, chainId, ...options?.context },
    });
  }
}

/**
 * Thrown when a contract call fails to encode (ABI mismatch, wrong types).
 */
export class ContractEncodingError extends AppError {
  readonly code = "CONTRACT_ENCODING_FAILED";
  readonly statusCode = 400;
  readonly domain = "contract" as const;
  readonly severity = "medium" as const;
  readonly isOperational = true;

  constructor(
    method: string,
    reason: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(`Failed to encode call to '${method}': ${reason}.`, {
      ...options, context: { method, reason, ...options?.context },
    });
  }
}

/**
 * Thrown when a contract call reverts with a known or unknown error selector.
 */
export class ContractCallRevertedError extends AppError {
  readonly code = "CONTRACT_CALL_REVERTED";
  readonly statusCode = 422;
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
      { ...options, context: { method, revertData, decodedReason, ...options?.context } }
    );
  }
}

/**
 * Thrown when a contract's pause mechanism is active.
 * Common in DeFi protocols during upgrades or emergencies.
 */
export class ContractPausedError extends AppError {
  readonly code = "CONTRACT_PAUSED";
  readonly statusCode = 503;
  readonly domain = "contract" as const;
  readonly severity = "high" as const;
  readonly isOperational = true;
  override readonly retryable = true;

  constructor(contractAddress: string, options?: ConstructorParameters<typeof AppError>[1]) {
    super(`Contract at '${contractAddress}' is currently paused. Operations are temporarily unavailable.`, {
      ...options, context: { contractAddress, ...options?.context },
    });
  }
}

/**
 * Thrown when a token allowance is insufficient for a contract to spend
 * on behalf of the user (ERC-20 approve/transferFrom pattern).
 */
export class InsufficientAllowanceError extends AppError {
  readonly code = "CONTRACT_INSUFFICIENT_ALLOWANCE";
  readonly statusCode = 422;
  readonly domain = "contract" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(
    required: bigint,
    approved: bigint,
    tokenSymbol: string,
    spender: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(
      `Insufficient ${tokenSymbol} allowance for spender '${spender}'. Required: ${required}, approved: ${approved}.`,
      { ...options, context: { required: required.toString(), approved: approved.toString(), tokenSymbol, spender, ...options?.context } }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. DeFi (Swaps, Liquidity, Yield)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thrown when a swap's actual output falls below the user's configured
 * minimum (slippage tolerance exceeded).
 */
export class SlippageExceededError extends AppError {
  readonly code = "DEFI_SLIPPAGE_EXCEEDED";
  readonly statusCode = 422;
  readonly domain = "defi" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(
    expectedOut: bigint,
    actualOut: bigint,
    tokenSymbol: string,
    slippageBps: number,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(
      `Swap slippage exceeded. Expected minimum: ${expectedOut} ${tokenSymbol}, received: ${actualOut} ${tokenSymbol} (tolerance: ${slippageBps / 100}%).`,
      { ...options, context: { expectedOut: expectedOut.toString(), actualOut: actualOut.toString(), tokenSymbol, slippageBps, ...options?.context } }
    );
  }
}

/**
 * Thrown when a swap quote expires before the transaction is submitted.
 */
export class QuoteExpiredError extends AppError {
  readonly code = "DEFI_QUOTE_EXPIRED";
  readonly statusCode = 410;
  readonly domain = "defi" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(quoteId: string, expiredAt: string, options?: ConstructorParameters<typeof AppError>[1]) {
    super(`Swap quote '${quoteId}' expired at ${expiredAt}. Please request a fresh quote.`, {
      ...options, context: { quoteId, expiredAt, ...options?.context },
    });
  }
}

/**
 * Thrown when a liquidity pool has insufficient reserves to fill the swap.
 */
export class InsufficientLiquidityError extends AppError {
  readonly code = "DEFI_INSUFFICIENT_LIQUIDITY";
  readonly statusCode = 422;
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
      { ...options, context: { poolAddress, tokenIn, tokenOut, ...options?.context } }
    );
  }
}

/**
 * Thrown when a DEX route cannot be found between two tokens.
 */
export class NoRouteFoundError extends AppError {
  readonly code = "DEFI_NO_ROUTE_FOUND";
  readonly statusCode = 422;
  readonly domain = "defi" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(tokenIn: string, tokenOut: string, options?: ConstructorParameters<typeof AppError>[1]) {
    super(`No swap route found from ${tokenIn} to ${tokenOut}.`, {
      ...options, context: { tokenIn, tokenOut, ...options?.context },
    });
  }
}

/**
 * Thrown when a MEV sandwich attack or front-run is detected.
 */
export class MevDetectedError extends AppError {
  readonly code = "DEFI_MEV_DETECTED";
  readonly statusCode = 422;
  readonly domain = "defi" as const;
  readonly severity = "high" as const;
  readonly isOperational = true;

  constructor(txHash: string, options?: ConstructorParameters<typeof AppError>[1]) {
    super(`Potential MEV/sandwich attack detected for transaction '${txHash}'. Transaction aborted for user protection.`, {
      ...options, context: { txHash, ...options?.context },
    });
  }
}

/**
 * Thrown when a position would be liquidated at the requested action.
 */
export class LiquidationRiskError extends AppError {
  readonly code = "DEFI_LIQUIDATION_RISK";
  readonly statusCode = 422;
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
  readonly statusCode = 422;
  readonly domain = "defi" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(unlocksAt: string, options?: ConstructorParameters<typeof AppError>[1]) {
    super(`Funds are locked until ${unlocksAt}.`, {
      ...options, context: { unlocksAt, ...options?.context },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. AUTHENTICATION & AUTHORIZATION
// ─────────────────────────────────────────────────────────────────────────────

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
  readonly statusCode = 401;
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
  readonly statusCode = 403;
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
  readonly statusCode = 429;
  readonly domain = "auth" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;
  override readonly retryable = true;

  constructor(retryAfterMs: number, options?: ConstructorParameters<typeof AppError>[1]) {
    super("Rate limit exceeded. Please wait before retrying.", {
      ...options,
      retryable: true,
      retryAfterMs,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. COMPLIANCE, KYC & AML
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thrown when a user has not completed KYC and the requested action requires it.
 */
export class KycRequiredError extends AppError {
  readonly code = "COMPLIANCE_KYC_REQUIRED";
  readonly statusCode = 403;
  readonly domain = "compliance" as const;
  readonly severity = "medium" as const;
  readonly isOperational = true;

  constructor(
    requiredTier: "basic" | "enhanced" | "institutional",
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(`This action requires ${requiredTier} KYC verification. Please complete identity verification to proceed.`, {
      ...options, context: { requiredTier, ...options?.context },
    });
  }
}

/**
 * Thrown when a KYC check is still in progress.
 */
export class KycPendingError extends AppError {
  readonly code = "COMPLIANCE_KYC_PENDING";
  readonly statusCode = 202;
  readonly domain = "compliance" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;
  override readonly retryable = true;

  constructor(submittedAt: string, options?: ConstructorParameters<typeof AppError>[1]) {
    super(`KYC verification is still in progress (submitted: ${submittedAt}). Please check back shortly.`, {
      ...options, context: { submittedAt, ...options?.context },
    });
  }
}

/**
 * Thrown when a wallet address is on a sanctions list (OFAC, EU, UN).
 */
export class SanctionedAddressError extends AppError {
  readonly code = "COMPLIANCE_ADDRESS_SANCTIONED";
  readonly statusCode = 403;
  readonly domain = "compliance" as const;
  readonly severity = "critical" as const;
  readonly isOperational = true;

  constructor(options?: ConstructorParameters<typeof AppError>[1]) {
    // Deliberately vague — do not confirm which list or specific address
    super("This transaction cannot be processed due to compliance restrictions.", options);
  }
}

/**
 * Thrown when a transaction is flagged by AML screening.
 */
export class AmlFlaggedError extends AppError {
  readonly code = "COMPLIANCE_AML_FLAGGED";
  readonly statusCode = 403;
  readonly domain = "compliance" as const;
  readonly severity = "critical" as const;
  readonly isOperational = true;

  constructor(reviewId: string, options?: ConstructorParameters<typeof AppError>[1]) {
    super("This transaction has been flagged for manual review and cannot be processed at this time.", {
      ...options, context: { reviewId, ...options?.context },
    });
  }
}

/**
 * Thrown when a transaction originates from or is destined for a restricted jurisdiction.
 */
export class RestrictedJurisdictionError extends AppError {
  readonly code = "COMPLIANCE_RESTRICTED_JURISDICTION";
  readonly statusCode = 451;
  readonly domain = "compliance" as const;
  readonly severity = "high" as const;
  readonly isOperational = true;

  constructor(options?: ConstructorParameters<typeof AppError>[1]) {
    super("This service is not available in your jurisdiction.", options);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. MARKET DATA & ORACLES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thrown when an oracle price feed is stale beyond the configured threshold.
 */
export class StalePriceError extends AppError {
  readonly code = "MARKET_PRICE_STALE";
  readonly statusCode = 503;
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
      { ...options, context: { feed, lastUpdatedAt, maxAgeSeconds, ...options?.context } }
    );
  }
}

/**
 * Thrown when a price deviates beyond an acceptable threshold between two sources,
 * suggesting manipulation or feed failure.
 */
export class PriceDeviationError extends AppError {
  readonly code = "MARKET_PRICE_DEVIATION";
  readonly statusCode = 503;
  readonly domain = "market" as const;
  readonly severity = "critical" as const;
  readonly isOperational = true;

  constructor(
    asset: string,
    sourceA: string,
    priceA: string,
    sourceB: string,
    priceB: string,
    deviationPercent: number,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(
      `Price deviation for ${asset}: ${sourceA} reports ${priceA}, ${sourceB} reports ${priceB} (${deviationPercent.toFixed(2)}% deviation). Transaction halted.`,
      { ...options, context: { asset, sourceA, priceA, sourceB, priceB, deviationPercent, ...options?.context } }
    );
  }
}

/**
 * Thrown when a requested token pair has no price feed available.
 */
export class PriceFeedUnavailableError extends AppError {
  readonly code = "MARKET_PRICE_FEED_UNAVAILABLE";
  readonly statusCode = 503;
  readonly domain = "market" as const;
  readonly severity = "high" as const;
  readonly isOperational = true;
  override readonly retryable = true;

  constructor(pair: string, options?: ConstructorParameters<typeof AppError>[1]) {
    super(`No price feed available for pair '${pair}'.`, {
      ...options, context: { pair, ...options?.context },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. INFRASTRUCTURE (RPC, Chain, External Services)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thrown when all configured RPC endpoints fail or are unreachable.
 */
export class RpcUnavailableError extends AppError {
  readonly code = "INFRA_RPC_UNAVAILABLE";
  readonly statusCode = 503;
  readonly domain = "infrastructure" as const;
  readonly severity = "critical" as const;
  readonly isOperational = true;
  override readonly retryable = true;

  constructor(chainId: number, options?: ConstructorParameters<typeof AppError>[1]) {
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
  readonly statusCode = 400;
  readonly domain = "infrastructure" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(chainId: number, options?: ConstructorParameters<typeof AppError>[1]) {
    super(`Chain ID ${chainId} is not supported.`, {
      ...options, context: { chainId, ...options?.context },
    });
  }
}

/**
 * Thrown when a chain reorganization invalidates a previously confirmed transaction.
 */
export class ChainReorgError extends AppError {
  readonly code = "INFRA_CHAIN_REORG";
  readonly statusCode = 409;
  readonly domain = "infrastructure" as const;
  readonly severity = "high" as const;
  readonly isOperational = true;
  override readonly retryable = true;

  constructor(
    txHash: string,
    depth: number,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(`Chain reorganization detected (depth: ${depth} blocks). Transaction '${txHash}' may need to be resubmitted.`, {
      ...options, context: { txHash, depth, ...options?.context },
    });
  }
}

/**
 * Thrown when an external service (bridge, CEX, custody provider) fails.
 */
export class ExternalServiceError extends AppError {
  readonly code: string;
  readonly statusCode = 502;
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
  readonly statusCode = 500;
  readonly domain = "infrastructure" as const;
  readonly severity = "critical" as const;
  readonly isOperational = false; // ← BUG. Always alert.

  override toResponse(): ErrorEnvelope {
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

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes any unknown thrown value into a typed AppError.
 * Used at the tryCatch / neverthrow boundary.
 */
export const toAppError = (e: unknown, traceId: string): AppError => {
  if (e instanceof AppError) return e;
  return new InternalError(
    "An unhandled exception was caught at the system boundary.",
    { cause: e, traceId: traceId }
  );
};