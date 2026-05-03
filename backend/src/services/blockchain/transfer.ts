/**
 * P2P token transfer — moves ONE tokens between two custodial wallets.
 *
 * Used by the transfer (send money) flow. The sender's custodial wallet
 * signs the ERC-20 transfer() call, so this function decrypts the sender's
 * private key at call time.
 *
 * An ETH gas pre-check is performed before simulation to provide a clear
 * error when the custodial wallet has been depleted of native gas funds.
 *
 * Flow: validate addresses → decrypt key → gas check → simulate → broadcast → wait.
 */
import { ResultAsync } from "neverthrow";
import { createWalletClient, http, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  ONECURRENCY_ADDRESS,
  OneCurrencyABI,
} from "@/common/contracts/one-currency";
import type { AppError } from "@/common/errors/base";
import { TransactionRevertedError } from "@/common/errors/transaction";
import { InsufficientGasError } from "@/common/errors/transfer";
import {
  InvalidAddressError,
  WalletSigningError,
} from "@/common/errors/wallet";
import { MIN_CONFIRMATIONS } from "../../constants/blockchain";
import { decrypt } from "../../lib/encryption";
import { logger } from "../../lib/logger";
import { chain, publicClient, rpcUrl } from "./client";
import { mapBlockchainError } from "./helpers";

/**
 * Conservative gas estimate for a standard ERC-20 transfer.
 * Used for the pre-flight gas balance check.
 */
const TRANSFER_GAS_ESTIMATE = 65_000n;

/**
 * Transfers ONE tokens from the sender's custodial wallet to `toAddress`.
 *
 * @param encryptedPrivateKey  The sender's private key encrypted at rest.
 * @param toAddress            The recipient's Ethereum address.
 * @param amountWei            Exact transfer amount in Wei as a decimal string.
 * @returns                    `Ok(txHash)` on success, or a typed `AppError` on failure.
 */
export function transferTokens(
  encryptedPrivateKey: string,
  toAddress: string,
  amountWei: string
): ResultAsync<string, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      if (!isAddress(toAddress)) {
        throw new InvalidAddressError(toAddress);
      }

      let decryptedKey: string;
      try {
        decryptedKey = decrypt(encryptedPrivateKey);
      } catch (decryptErr) {
        throw new WalletSigningError(
          "Failed to decrypt custodial wallet private key",
          { cause: decryptErr }
        );
      }

      const formattedKey = decryptedKey.startsWith("0x")
        ? decryptedKey
        : `0x${decryptedKey}`;
      const senderAccount = privateKeyToAccount(formattedKey as `0x${string}`);

      // Pre-flight gas check: ensure the custodial wallet has enough ETH to
      // cover the estimated gas cost before submitting the simulation
      const nativeBalance = await publicClient.getBalance({
        address: senderAccount.address,
      });
      const gasPrice = await publicClient.getGasPrice();
      const estimatedGasCost = TRANSFER_GAS_ESTIMATE * gasPrice;

      if (nativeBalance < estimatedGasCost) {
        logger.error(
          {
            address: senderAccount.address,
            nativeBalance: nativeBalance.toString(),
            estimatedGasCost: estimatedGasCost.toString(),
          },
          "Custodial wallet has insufficient ETH for gas"
        );
        throw new InsufficientGasError({
          context: {
            address: senderAccount.address,
            nativeBalance: nativeBalance.toString(),
            estimatedGasCost: estimatedGasCost.toString(),
          },
        });
      }

      logger.info(
        { from: senderAccount.address, to: toAddress, amountWei },
        "Initiating P2P transfer transaction..."
      );

      const senderWalletClient = createWalletClient({
        account: senderAccount,
        chain,
        transport: http(rpcUrl),
      });

      const { request } = await publicClient.simulateContract({
        address: ONECURRENCY_ADDRESS as `0x${string}`,
        abi: OneCurrencyABI,
        functionName: "transfer",
        args: [toAddress as `0x${string}`, BigInt(amountWei)],
        chain,
        account: senderAccount,
      });

      logger.info(
        "Transfer simulation successful. Broadcasting transaction..."
      );

      const txHash = await senderWalletClient.writeContract(request);

      logger.info(
        { txHash },
        "Transfer transaction broadcasted. Waiting for confirmation..."
      );

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: MIN_CONFIRMATIONS,
      });

      if (receipt.status === "reverted") {
        throw new TransactionRevertedError(
          txHash,
          "Transfer transaction reverted on-chain after broadcast."
        );
      }

      logger.info(
        { txHash: receipt.transactionHash, blockNumber: receipt.blockNumber },
        "P2P transfer transaction successfully confirmed!"
      );

      return receipt.transactionHash;
    })(),
    (e) =>
      mapBlockchainError(
        e,
        "transfer",
        "An unhandled exception was caught during token transfer."
      )
  );
}
