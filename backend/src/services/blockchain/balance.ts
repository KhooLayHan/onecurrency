/**
 * On-chain balance reads.
 *
 * Provides a thin wrapper around the ERC-20 `balanceOf` call so callers
 * receive a neverthrow `ResultAsync` instead of a raw promise that throws.
 */
import { ResultAsync } from "neverthrow";
import { HttpRequestError, TimeoutError } from "viem";
import {
  ONECURRENCY_ADDRESS,
  OneCurrencyABI,
} from "@/common/contracts/one-currency";
import type { AppError } from "@/common/errors/base";
import { InternalError } from "@/common/errors/infrastructure";
import { publicClient } from "./client";
import { handleNetworkError } from "./helpers";

/**
 * Returns the current ONE token balance for the given address.
 *
 * @param address  The Ethereum address to query (must be a valid checksum address).
 * @returns        `Ok(balanceWei)` where the value is the raw Wei amount as a
 *                 decimal string, or a typed `AppError` on failure.
 */
export function getOnChainBalance(
  address: string
): ResultAsync<string, AppError> {
  return ResultAsync.fromPromise(
    publicClient.readContract({
      address: ONECURRENCY_ADDRESS as `0x${string}`,
      abi: OneCurrencyABI,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    }) as Promise<bigint>,
    (e): AppError => {
      if (e instanceof HttpRequestError || e instanceof TimeoutError) {
        return handleNetworkError(e);
      }
      return new InternalError("Failed to read on-chain token balance", {
        cause: e,
        context: { address },
      });
    }
  ).map((balance) => balance.toString());
}
