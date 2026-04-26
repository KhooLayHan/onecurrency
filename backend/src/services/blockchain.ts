import { ResultAsync } from "neverthrow";
import {
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  HttpRequestError,
  http,
  isAddress,
  TimeoutError,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat, sepolia } from "viem/chains";
import {
  ONECURRENCY_ADDRESS,
  OneCurrencyABI,
} from "@/common/contracts/one-currency";
import { AppError } from "@/common/errors/base";
import { ContractCallRevertedError } from "@/common/errors/contract";
import {
  InternalError,
  RpcUnavailableError,
} from "@/common/errors/infrastructure";
import { TransactionRevertedError } from "@/common/errors/transaction";
import { InvalidAddressError } from "@/common/errors/wallet";
import { HARDHAT_CHAIN_ID, SEPOLIA_CHAIN_ID } from "../constants/blockchain";
import { env } from "../env";
import { logger } from "../lib/logger";

// 1. Determine the correct chain and RPC Provider
const isProd = env.NODE_ENV === "production";
const chain = isProd ? sepolia : hardhat;
const rpcUrl = isProd ? env.SEPOLIA_RPC_URL : env.LOCAL_RPC_URL;

// 2. Initialize the Public Client (For reading data and simulating txs)
const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
});

// 3. Initialize the Signer Acount (The "Relayer" Wallet)
if (!env.SEPOLIA_PRIVATE_KEY) {
  logger.fatal(
    "SEPOLIA_PRIVATE_KEY is missing from environment! Cannot initialize minter."
  );
  throw new Error("SEPOLIA_PRIVATE_KEY is required for blockchain service");
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
export function mintTokens(
  toAddress: string,
  amountWei: string
): ResultAsync<string, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      // 1. Input Validation (Viem's built-in isAddress)
      if (!isAddress(toAddress)) {
        throw new InvalidAddressError(toAddress);
      }

      logger.info({ toAddress, amountWei }, "Initiating mint transaction...");

      // 2. Simulate (Saves gas. Will throw immediately if blacklisted or lacking roles)
      const { request } = await publicClient.simulateContract({
        address: ONECURRENCY_ADDRESS as `0x${string}`,
        abi: OneCurrencyABI,
        functionName: "mint",
        args: [toAddress as `0x${string}`, BigInt(amountWei)],
        chain,
        account,
      });

      logger.info("Simulation successful. Broadcasting transaction...");

      // 3. Broadcast the transaction
      const txHash = await walletClient.writeContract(request);

      logger.info(
        { txHash },
        "Mint transaction broadcasted. Waiting for confirmation..."
      );

      // 4. Wait for receipt (1 block for MVP speed)
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
      });

      logger.info(txHash);

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

    // The Error Mapper (Catching throws and turning them into typed objects)
    (e): AppError => {
      // If we manually threw an AppError (like INVALID_WALLET_ADDRESS), pass it through
      if (e instanceof AppError) {
        return e;
      }

      if (e instanceof HttpRequestError || e instanceof TimeoutError) {
        return handleNetworkError(e);
      }
      if (e instanceof ContractFunctionRevertedError) {
        return handleContractRevert(e);
      }

      // Fallback for unknown errors
      return new InternalError(
        "An unhandled exception was caught at the system boundary.",
        { cause: e }
      );
    }
  );
}

function isErrorMessage(
  e: unknown
): e is { message?: string; shortMessage?: string } {
  return (
    typeof e === "object" &&
    e !== null &&
    ("message" in e || "shortMessage" in e)
  );
}

const handleNetworkError = (e: unknown): AppError => {
  const chainId = isProd ? SEPOLIA_CHAIN_ID : HARDHAT_CHAIN_ID;
  return new RpcUnavailableError(chainId, {
    cause: e,
    context: {
      originalError: isErrorMessage(e) ? e.message : "Unknown error occurred.",
    },
  });
};

const handleContractRevert = (e: unknown): AppError => {
  const reason = isErrorMessage(e) ? e.message : "Unknown error occurred.";
  return new ContractCallRevertedError("mint", undefined, reason, {
    cause: e,
  });
};
