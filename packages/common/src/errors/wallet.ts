/**
 * wallet.ts
 *
 * Wallet & Key Management errors.
 * Covers EVM addresses, balance checks, key derivation, and signing.
 */

import { StatusCodes } from "http-status-codes";
import { AppError } from "./base";

/**
 * Thrown when a wallet address fails checksum or format validation.
 * Covers EVM (0x…), Solana (base58), and other chain formats.
 */
export class InvalidAddressError extends AppError {
  readonly code = "WALLET_ADDRESS_INVALID";
  readonly statusCode = StatusCodes.BAD_REQUEST;
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
  readonly statusCode = StatusCodes.UNPROCESSABLE_ENTITY;
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
      {
        ...options,
        context: {
          required: required.toString(),
          available: available.toString(),
          tokenSymbol,
          ...options?.context,
        },
      }
    );
  }
}

/**
 * Thrown when a wallet cannot be found by address or internal ID.
 */
export class WalletNotFoundError extends AppError {
  readonly code = "WALLET_NOT_FOUND";
  readonly statusCode = StatusCodes.NOT_FOUND;
  readonly domain = "wallet" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(
    identifier: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(`Wallet '${identifier}' was not found.`, {
      ...options,
      context: { identifier, ...options?.context },
    });
  }
}

/**
 * Thrown when wallet signing fails — wrong key, locked keystore, or HSM error.
 */
export class WalletSigningError extends AppError {
  readonly code = "WALLET_SIGNING_FAILED";
  readonly statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  readonly domain = "wallet" as const;
  readonly severity = "high" as const;
  readonly isOperational = true;

  constructor(
    reason: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(`Wallet signing failed: ${reason}.`, {
      ...options,
      context: { reason, ...options?.context },
    });
  }
}

/**
 * Thrown when a private key format is invalid or cannot be imported.
 */
export class InvalidPrivateKeyError extends AppError {
  readonly code = "WALLET_PRIVATE_KEY_INVALID";
  readonly statusCode = StatusCodes.BAD_REQUEST;
  readonly domain = "wallet" as const;
  readonly severity = "high" as const;
  readonly isOperational = true;

  constructor(options?: ConstructorParameters<typeof AppError>[1]) {
    // Never include the key itself in the message or context
    super(
      "The provided private key is malformed or uses an unsupported format.",
      options
    );
  }
}

/**
 * Thrown when the derivation path for HD wallet key derivation is invalid.
 */
export class InvalidDerivationPathError extends AppError {
  readonly code = "WALLET_DERIVATION_PATH_INVALID";
  readonly statusCode = StatusCodes.BAD_REQUEST;
  readonly domain = "wallet" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(
    path: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(`Derivation path '${path}' is not a valid BIP-44 path.`, {
      ...options,
      context: { path, ...options?.context },
    });
  }
}
