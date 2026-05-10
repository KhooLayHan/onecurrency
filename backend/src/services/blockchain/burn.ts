/**
 * Token burning — destroys ONE tokens from a custodial wallet.
 *
 * Used by the withdrawal (cash-out) flow: the user's custodial wallet signs
 * the burn transaction itself, so this function decrypts the user's private
 * key at call time.
 *
 * Flow: decrypt key → derive account → simulate → broadcast → wait for receipt.
 */
import { ResultAsync } from "neverthrow";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { OneCurrencyABI } from "@/common/contracts/one-currency";
import type { AppError } from "@/common/errors/base";
import { TransactionRevertedError } from "@/common/errors/transaction";
import { InsufficientGasError } from "@/common/errors/transfer";
import { WalletSigningError } from "@/common/errors/wallet";
import { MIN_CONFIRMATIONS } from "../../constants/blockchain";
import { env } from "../../env";
import { decrypt } from "../../lib/encryption";
import { logger } from "../../lib/logger";
import { chain, publicClient, rpcUrl } from "./client";
import { mapBlockchainError } from "./helpers";

const BURN_GAS_ESTIMATE = 65_000n;

/**
 * Burns ONE tokens from the custodial wallet identified by `encryptedPrivateKey`.
 *
 * @param encryptedPrivateKey  The user's private key encrypted at rest (IV:AuthTag:Ciphertext).
 * @param amountWei            Exact burn amount in Wei as a decimal string.
 * @returns                    `Ok(txHash)` on success, or a typed `AppError` on failure.
 */
export function burnTokens(
  encryptedPrivateKey: string,
  amountWei: string
): ResultAsync<string, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      // Decrypt the user's private key — fail fast with a typed error if it cannot be read
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
      const userAccount = privateKeyToAccount(formattedKey as `0x${string}`);

      const nativeBalance = await publicClient.getBalance({
        address: userAccount.address,
      });
      const gasPrice = await publicClient.getGasPrice();
      const estimatedGasCost = BURN_GAS_ESTIMATE * gasPrice;

      if (nativeBalance < estimatedGasCost) {
        logger.error(
          { address: userAccount.address, nativeBalance, estimatedGasCost },
          "Custodial wallet has insufficient ETH for gas"
        );
        throw new InsufficientGasError({
          context: {
            address: userAccount.address,
            nativeBalance: nativeBalance.toString(),
            estimatedGasCost: estimatedGasCost.toString(),
          },
        });
      }

      logger.info(
        { address: userAccount.address, amountWei },
        "Initiating burn transaction..."
      );

      // Create a per-request wallet client scoped to the user's account
      const userWalletClient = createWalletClient({
        account: userAccount,
        chain,
        transport: http(rpcUrl),
      });

      const { request } = await publicClient.simulateContract({
        address: env.ONECURRENCY_ADDRESS as `0x${string}`,
        abi: OneCurrencyABI,
        functionName: "burn",
        args: [BigInt(amountWei)],
        chain,
        account: userAccount,
      });

      logger.info("Burn simulation successful. Broadcasting transaction...");

      const txHash = await userWalletClient.writeContract(request);

      logger.info(
        { txHash },
        "Burn transaction broadcasted. Waiting for confirmation..."
      );

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: MIN_CONFIRMATIONS,
      });

      if (receipt.status === "reverted") {
        throw new TransactionRevertedError(
          txHash,
          "Burn transaction reverted on-chain after broadcast."
        );
      }

      logger.info(
        { txHash: receipt.transactionHash, blockNumber: receipt.blockNumber },
        "Burn transaction successfully confirmed!"
      );

      return receipt.transactionHash;
    })(),
    (e) =>
      mapBlockchainError(
        e,
        "burn",
        "An unhandled exception was caught during token burn."
      )
  );
}
