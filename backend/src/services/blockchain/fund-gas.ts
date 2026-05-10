import { ResultAsync } from "neverthrow";
import { formatEther, parseEther } from "viem";
import type { AppError } from "@/common/errors/base";
import { InternalError } from "@/common/errors/infrastructure";
import { logger } from "../../lib/logger";
import { chain, getOperatorAccount, publicClient } from "./client";

const MIN_GAS_BALANCE_WEI = parseEther("0.001"); // 0.001 ETH ≈ ~10-20 tx
const GAS_TOP_UP_WEI = parseEther("0.010"); // 0.01 ETH  ≈ ~100-200 tx

/**
 * Sends ETH from the operator wallet to a custodial wallet if its balance
 * is below the minimum threshold. Non-blocking — callers fire-and-forget.
 *
 * @param toAddress The address to be funded gas with.
 * @returns         The gas funding txHash, or `null` if wallet was already funded.
 */
export function fundGasIfNeeded(
  toAddress: string
): ResultAsync<string | null, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      const balance = await publicClient.getBalance({
        address: toAddress as `0x${string}`,
      });
      if (balance >= MIN_GAS_BALANCE_WEI) {
        return null;
      }
      logger.info(
        { toAddress, currentBalance: formatEther(balance) },
        "Funding gas for custodial wallet"
      );
      const { walletClient } = getOperatorAccount();
      const txHash = await walletClient.sendTransaction({
        to: toAddress as `0x${string}`,
        value: GAS_TOP_UP_WEI,
        chain,
      });
      logger.info(
        { txHash, toAddress, amount: formatEther(GAS_TOP_UP_WEI) },
        "Gas funded for custodial wallet"
      );
      return txHash;
    })(),
    (e): InternalError =>
      new InternalError("Failed to fund gas for custodial wallet", { cause: e })
  );
}
