/**
 * Shared helpers for blockchain operations.
 *
 * Contains two utilities that every contract-write function in this module
 * relies on:
 *
 * - `mapBlockchainError` — converts raw viem / unknown errors into typed
 *   `AppError` instances so callers can pattern-match on the result without
 *   inspecting raw exception types.
 *
 * - `isErrorMessage` — a narrow type-guard used by the error mapper.
 */
import {
  ContractFunctionRevertedError,
  HttpRequestError,
  TimeoutError,
} from "viem";
import { AppError } from "@/common/errors/base";
import { ContractCallRevertedError } from "@/common/errors/contract";
import {
  InternalError,
  RpcUnavailableError,
} from "@/common/errors/infrastructure";
import { HARDHAT_CHAIN_ID, SEPOLIA_CHAIN_ID } from "../../constants/blockchain";
import { env } from "../../env";

const isProd = env.NODE_ENV === "production";

/**
 * Type-guard that checks whether an unknown value carries a readable
 * `message` or `shortMessage` string (common on viem errors).
 */
export function isErrorMessage(
  e: unknown
): e is { message?: string; shortMessage?: string } {
  return (
    typeof e === "object" &&
    e !== null &&
    ("message" in e || "shortMessage" in e)
  );
}

/**
 * Converts a network-layer error into a typed `RpcUnavailableError`.
 * Used whenever a viem `HttpRequestError` or `TimeoutError` is caught.
 */
export function handleNetworkError(e: unknown): AppError {
  const chainId = isProd ? SEPOLIA_CHAIN_ID : HARDHAT_CHAIN_ID;
  return new RpcUnavailableError(chainId, {
    cause: e,
    context: {
      originalError: isErrorMessage(e) ? e.message : "Unknown error occurred.",
    },
  });
}

/**
 * Converts a contract-revert error into a typed `ContractCallRevertedError`.
 *
 * @param e           The raw error caught from viem.
 * @param functionName The Solidity function name (used in the error message).
 */
export function handleContractRevert(
  e: unknown,
  functionName: string
): AppError {
  const reason = isErrorMessage(e) ? e.message : "Unknown error occurred.";
  return new ContractCallRevertedError(functionName, undefined, reason, {
    cause: e,
  });
}

/**
 * Central error mapper for all blockchain operations.
 *
 * Call this as the second argument to `ResultAsync.fromPromise` so that every
 * raw exception is normalised into a typed `AppError` before bubbling up to
 * callers.
 *
 * Precedence:
 * 1. If it's already an `AppError`, pass it through unchanged.
 * 2. Network / timeout errors → `RpcUnavailableError`.
 * 3. Contract revert → `ContractCallRevertedError`.
 * 4. Anything else → generic `InternalError`.
 *
 * @param e            The raw caught exception.
 * @param functionName Solidity function name (for revert messages).
 * @param fallbackMsg  Message used for the generic `InternalError` fallback.
 */
export function mapBlockchainError(
  e: unknown,
  functionName: string,
  fallbackMsg: string
): AppError {
  if (e instanceof AppError) {
    return e;
  }
  if (e instanceof HttpRequestError || e instanceof TimeoutError) {
    return handleNetworkError(e);
  }
  if (e instanceof ContractFunctionRevertedError) {
    return handleContractRevert(e, functionName);
  }
  return new InternalError(fallbackMsg, { cause: e });
}
