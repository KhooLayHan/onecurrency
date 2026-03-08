import { ResultAsync } from "neverthrow";
import { env } from "../env";
import { logger } from "../lib/logger";
import { OneCurrencyABI, ONECURRENCY_ADDRESS } from "@/common/contracts/OneCurrency"; 

import { createPublicClient, createWalletClient, http, isAddress } from "viem";
import { AppError, BlockchainError } from "../lib/errors";
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

// 4. Initialize the Wallet Client (For signing and sending txs)
const walletClient = createWalletClient({
  account,
  chain,
  transport: http(rpcUrl),
});

/**
 * Mints ONE tokens to a specified user's wallet address.
 * 
 * @param toAddress The user's Ethereum address
 * @param amountWei The exact amount in Wei (string to avoid JS precision loss)
 * @returns ResultAsync containing the Transaction Hash or a BlockchainError
 */
export function mintTokens(toAddress: string, amountWei: string): ResultAsync<string, BlockchainError> {
  return ResultAsync.fromPromise(
    (async () => {
      // 1. Input Validation (Viem's built-in isAddress)
      if (!isAddress(toAddress)) {
        throw new BlockchainError("INVALID_WALLET_ADDRESS", `The address ${toAddress} is not valid.`);
      }

      logger.info({ toAddress, amountWei }, "Initiating mint transaction...");

      // 2. Simulate (Saves gas. Will throw immediately if blacklisted or lacking roles)
      const { request } = await publicClient.simulateContract({
        address: ONECURRENCY_ADDRESS as `0x${string}`,
        abi: OneCurrencyABI,
        functionName: "mint",
        args: [toAddress as `0x${string}`, BigInt(amountWei)],
        account,
      })

      logger.info("Simulation successful. Broadcasting transaction...");
      
      // 3. Broadcast the transaction
      const txHash = await walletClient.writeContract(request);
      
      logger.info({ txHash }, "Mint transaction broadcasted. Waiting for confirmation...");

      // 4. Wait for receipt (1 block for MVP speed)
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
      });

      if (receipt.status === "reverted") {
        throw new BlockchainError("TRANSACTION_REVERTED", "Transaction reverted on-chain after broadcast.");
      }

      logger.info(
        { txHash: receipt.transactionHash, blockNumber: receipt.blockNumber }, 
        "Mint transaction successfully confirmed!"
      );
      
      return receipt.transactionHash;
    })(),

    // The Error Mapper (Catching throws and turning them into typed objects)
    (e: any): AppError => {
      // If we manually threw an AppError (like INVALID_WALLET_ADDRESS), pass it through
      if (e instanceof AppError) return e;

      // Map specific Viem errors
      const errorName = e.name || "";

      // Handle RPC / Network failures
      if (errorName.includes("HttpRequestError") || errorName.includes("TimeoutError")) {
        return new BlockchainError("BLOCKCHAIN_NETWORK_ERROR", "Lost connection to the blockchain RPC node.", { originalError: e.message });
      }
      
      // Handle Smart Contract Reverts (Caught perfectly by simulateContract)
      if (errorName.includes("ContractFunctionRevertedError")) {
        return new BlockchainError("TRANSACTION_REVERTED", "The smart contract rejected the transaction. The user might be blacklisted.", { reason: e.message });
      }
      
      // Fallback for unknown errors
      return new BlockchainError("INTERNAL_SERVER_ERROR", e.shortMessage || e.message || "Unexpected blockchain failure.");
    }
  );
}
