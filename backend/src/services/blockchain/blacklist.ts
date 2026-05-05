/**
 * Blacklist and seizure operations on the OneCurrency contract.
 *
 * These three functions are called exclusively by the admin compliance flow:
 *   - `blacklistAddress`   — prevents an address from sending/receiving tokens.
 *   - `unblacklistAddress` — reinstates a previously blacklisted address.
 *   - `seizeAddressTokens` — forcibly moves all tokens from a blacklisted
 *                            address to the treasury wallet.
 *
 * All operations are signed by the platform operator wallet (see `client.ts`).
 */
import { ResultAsync } from "neverthrow";
import { isAddress } from "viem";
import {
  ONECURRENCY_ADDRESS,
  OneCurrencyABI,
} from "@/common/contracts/one-currency";
import type { AppError } from "@/common/errors/base";
import { ContractCallRevertedError } from "@/common/errors/contract";
import { TransactionRevertedError } from "@/common/errors/transaction";
import { InvalidAddressError } from "@/common/errors/wallet";
import { MIN_CONFIRMATIONS } from "../../constants/blockchain";
import { logger } from "../../lib/logger";
import { chain, getOperatorAccount, publicClient } from "./client";
import { mapBlockchainError } from "./helpers";

/**
 * Blacklists an Ethereum address on-chain, blocking all token movements.
 *
 * @param address  The address to blacklist (must be a valid checksum address).
 * @returns        `Ok(txHash)` on success, or a typed `AppError` on failure.
 */
export function blacklistAddress(
  address: string
): ResultAsync<string, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      if (!isAddress(address)) {
        throw new InvalidAddressError(address);
      }

      logger.info({ address }, "Blacklisting address on-chain...");

      const { account, walletClient } = getOperatorAccount();

      const { request } = await publicClient.simulateContract({
        address: ONECURRENCY_ADDRESS as `0x${string}`,
        abi: OneCurrencyABI,
        functionName: "blacklistAccount",
        args: [address as `0x${string}`],
        chain,
        account,
      });

      const txHash = await walletClient.writeContract(request);

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: MIN_CONFIRMATIONS,
      });

      if (receipt.status === "reverted") {
        throw new TransactionRevertedError(
          txHash,
          "Transaction reverted on-chain after broadcast."
        );
      }

      logger.info({ address, txHash }, "Address blacklisted on-chain");
      return receipt.transactionHash;
    })(),
    (e) =>
      mapBlockchainError(
        e,
        "blacklistAccount",
        "Failed to blacklist address on-chain"
      )
  );
}

/**
 * Removes an address from the on-chain blacklist, restoring token access.
 *
 * @param address  The address to unblacklist.
 * @returns        `Ok(txHash)` on success, or a typed `AppError` on failure.
 */
export function unblacklistAddress(
  address: string
): ResultAsync<string, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      if (!isAddress(address)) {
        throw new InvalidAddressError(address);
      }

      logger.info({ address }, "Removing address from on-chain blacklist...");

      const { account, walletClient } = getOperatorAccount();

      const { request } = await publicClient.simulateContract({
        address: ONECURRENCY_ADDRESS as `0x${string}`,
        abi: OneCurrencyABI,
        functionName: "unblacklistAccount",
        args: [address as `0x${string}`],
        chain,
        account,
      });

      const txHash = await walletClient.writeContract(request);

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: MIN_CONFIRMATIONS,
      });

      if (receipt.status === "reverted") {
        throw new TransactionRevertedError(
          txHash,
          "Transaction reverted on-chain after broadcast."
        );
      }

      logger.info(
        { address, txHash },
        "Address removed from on-chain blacklist"
      );
      return receipt.transactionHash;
    })(),
    (e) =>
      mapBlockchainError(
        e,
        "unblacklistAccount",
        "Failed to unblacklist address on-chain"
      )
  );
}

/**
 * Seizes all ONE tokens from `fromAddress` and transfers them to `toAddress`.
 *
 * Intended for compliance enforcement against blacklisted wallets. The
 * destination is typically the platform treasury address.
 *
 * @param fromAddress  The blacklisted address to seize tokens from.
 * @param toAddress    The treasury/destination address to receive the tokens.
 * @returns            `Ok(txHash)` on success, or a typed `AppError` on failure.
 */
export function seizeAddressTokens(
  fromAddress: string,
  toAddress: string
): ResultAsync<string, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      if (!isAddress(fromAddress)) {
        throw new InvalidAddressError(fromAddress);
      }
      if (!isAddress(toAddress)) {
        throw new InvalidAddressError(toAddress);
      }

      logger.info({ fromAddress, toAddress }, "Seizing tokens on-chain...");

      const { account, walletClient } = getOperatorAccount();

      const balance = await publicClient.readContract({
        address: ONECURRENCY_ADDRESS as `0x${string}`,
        abi: OneCurrencyABI,
        functionName: "balanceOf",
        args: [fromAddress as `0x${string}`],
      });

      if (balance === 0n) {
        throw new ContractCallRevertedError(
          "seizeTokens",
          undefined,
          "Address has no tokens to seize"
        );
      }

      const { request } = await publicClient.simulateContract({
        address: ONECURRENCY_ADDRESS as `0x${string}`,
        abi: OneCurrencyABI,
        functionName: "seizeTokens",
        args: [fromAddress as `0x${string}`, toAddress as `0x${string}`],
        chain,
        account,
      });

      const txHash = await walletClient.writeContract(request);

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: MIN_CONFIRMATIONS,
      });

      if (receipt.status === "reverted") {
        throw new TransactionRevertedError(
          txHash,
          "Transaction reverted on-chain after broadcast."
        );
      }

      logger.info({ fromAddress, toAddress, txHash }, "Tokens seized on-chain");
      return receipt.transactionHash;
    })(),
    (e) =>
      mapBlockchainError(e, "seizeTokens", "Failed to seize tokens on-chain")
  );
}
