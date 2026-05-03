/**
 * Token minting — adds ONE tokens to a user's custodial wallet.
 *
 * Used by the deposit flow after a successful Stripe payment:
 *   DepositService → mintTokens → on-chain ERC-20 mint
 *
 * Flow: validate address → simulate → broadcast → wait for receipt.
 */
import { ResultAsync } from "neverthrow";
import { isAddress } from "viem";
import {
  ONECURRENCY_ADDRESS,
  OneCurrencyABI,
} from "@/common/contracts/one-currency";
import type { AppError } from "@/common/errors/base";
import { TransactionRevertedError } from "@/common/errors/transaction";
import { InvalidAddressError } from "@/common/errors/wallet";
import { logger } from "../../lib/logger";
import { account, chain, publicClient, walletClient } from "./client";
import { mapBlockchainError } from "./helpers";

/**
 * Mints ONE tokens to the specified wallet address.
 *
 * @param toAddress  The recipient's Ethereum address (must be a valid checksum address).
 * @param amountWei  Exact mint amount in Wei as a decimal string (avoids JS bigint precision loss).
 * @returns          `Ok(txHash)` on success, or a typed `AppError` on failure.
 */
export function mintTokens(
  toAddress: string,
  amountWei: string
): ResultAsync<string, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      if (!isAddress(toAddress)) {
        throw new InvalidAddressError(toAddress);
      }

      logger.info(
        { toAddress, amountWei, chainId: chain.id },
        "Initiating mint transaction..."
      );

      // Simulate first — catches permission / blacklist errors before spending gas
      const { request } = await publicClient.simulateContract({
        address: ONECURRENCY_ADDRESS as `0x${string}`,
        abi: OneCurrencyABI,
        functionName: "mint",
        args: [toAddress as `0x${string}`, BigInt(amountWei)],
        chain,
        account,
      });

      logger.info("Mint simulation successful. Broadcasting transaction...");

      const txHash = await walletClient.writeContract(request);

      logger.info(
        { txHash },
        "Mint transaction broadcasted. Waiting for confirmation..."
      );

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
      });

      if (receipt.status === "reverted") {
        throw new TransactionRevertedError(
          txHash,
          "Transaction reverted on-chain after broadcast."
        );
      }

      logger.info(
        { txHash: receipt.transactionHash, blockNumber: receipt.blockNumber },
        "Mint transaction successfully confirmed!"
      );

      return receipt.transactionHash;
    })(),
    (e) =>
      mapBlockchainError(
        e,
        "mint",
        "An unhandled exception was caught at the system boundary."
      )
  );
}
