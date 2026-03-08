import { ResultAsync } from "neverthrow";
import { env } from "../env";
import { logger } from "../lib/logger";
// import { OneCurrencyABI, ONE_CURRENCY_ADDRESS } from "common"; 

import { createPublicClient, http } from "viem";
import type { BlockchainError } from "../lib/errors";
import { localhost, sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// 1. Determine the correct chain and RPC Provider
const isProd = env.NODE_ENV === "production";
const chain = isProd ? sepolia : localhost;
const rpcUrl = isProd ? env.SEPOLIA_RPC_URL 
  : (env.LOCAL_RPC_URL);

// 2. Initialize the Public Client (For reading data and simulating txs)
const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
})


// 3. Initialize the Signer Acount (The "Relayer" Wallet)
if (!env.SEPOLIA_PRIVATE_KEY) {
  logger.fatal("SEPOLIA_PRIVATE_KEY is missing from environment! Cannot initialize minter.");
}

// Ensure the private key has the 0x prefix for viem
const formattedPrivateKey = env.SEPOLIA_PRIVATE_KEY?.startsWith("0x")
  ? env.SEPOLIA_PRIVATE_KEY
  : `0x${env.SEPOLIA_PRIVATE_KEY}`;

const account = privateKeyToAccount(formattedPrivateKey as `0x${string}`);

const minterWallet = new ethers.Wallet(formattedPrivateKey, provider);

/**
 * Mints ONE tokens to a specified user's wallet address.
 * 
 * @param toAddress The user's Ethereum address
 * @param amountWei The exact amount in Wei (string to avoid JS precision loss)
 * @returns ResultAsync containing the Transaction Hash OR a BlockchainError
 */
export function mintTokens(toAddress: string, amountWei: string): ResultAsync<string, BlockchainError> {
  return ResultAsync.fromPromise(
    // The Promise we are wrapping
    (async () => {
      // Input validation
      if (!ethers.isAddress(toAddress)) {
        throw new Error("INVALID_ADDRESS");
      }

      logger.info({ toAddress, amountWei }, "Initiating mint transaction...");

      // 1. Broadcast the transaction
      const tx = await oneCurrencyContract.mint(toAddress, amountWei);
      
      logger.info({ txHash: tx.hash }, "Mint transaction broadcasted. Waiting for confirmation...");

      // 2. Wait for confirmation (1 block for MVP speed)
      const receipt = await tx.wait(1);

      // Status 0 means the transaction reverted (e.g., address was blacklisted)
      if (receipt.status === 0) {
        throw new Error("TRANSACTION_REVERTED");
      }

      logger.info(
        { txHash: receipt.hash, blockNumber: receipt.blockNumber }, 
        "Mint transaction successfully confirmed!"
      );
      
      return receipt.hash;
    })(),

    // The Error Mapper (Catching throws and turning them into typed objects)
    (e: any): BlockchainError => {
      logger.error({ err: e, toAddress, amountWei }, "Blockchain minting failed");

      if (e.message === "INVALID_ADDRESS") {
        return { code: "INVALID_ADDRESS", message: `The address ${toAddress} is not a valid Ethereum address.` };
      }
      
      // Ethers.js throws CALL_EXCEPTION when a smart contract `revert` occurs
      if (e.message === "TRANSACTION_REVERTED" || e.code === "CALL_EXCEPTION") {
        return { 
          code: "TRANSACTION_REVERTED", 
          message: "The smart contract reverted the transaction. The user might be blacklisted or the relayer lacks MINTER_ROLE." 
        };
      }
      
      if (e.code === "NETWORK_ERROR" || e.code === "TIMEOUT") {
        return { code: "NETWORK_ERROR", message: "Lost connection to the blockchain RPC node." };
      }
      
      return { code: "UNKNOWN_ERROR", message: e.message || "An unexpected blockchain error occurred." };
    }
  );
}
