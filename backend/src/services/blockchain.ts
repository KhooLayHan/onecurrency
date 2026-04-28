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
import { InsufficientGasError } from "@/common/errors/transfer";
import {
  InvalidAddressError,
  WalletSigningError,
} from "@/common/errors/wallet";
import {
  HARDHAT_CHAIN_ID,
  MIN_CONFIRMATIONS,
  SEPOLIA_CHAIN_ID,
} from "../constants/blockchain";
import { env } from "../env";
import { decrypt } from "../lib/encryption";
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
        return handleContractRevert(e, "mint");
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

function handleContractRevert(e: unknown, functionName: string): AppError {
  const reason = isErrorMessage(e) ? e.message : "Unknown error occurred.";
  return new ContractCallRevertedError(functionName, undefined, reason, {
    cause: e,
  });
}

/**
 * Reads the on-chain ONE token balance for an address.
 *
 * @param address The user's Ethereum address
 * @returns ResultAsync containing the balance in Wei as a string
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

/**
 * Burns ONE tokens from a custodial wallet by decrypting the wallet's
 * private key and submitting a self-burn transaction.
 *
 * @param encryptedPrivateKey The user's encrypted private key (IV:AuthTag:Ciphertext)
 * @param amountWei The exact amount to burn in Wei
 * @returns ResultAsync containing the confirmed transaction hash
 */
export function burnTokens(
  encryptedPrivateKey: string,
  amountWei: string
): ResultAsync<string, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
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

      logger.info(
        { address: userAccount.address, amountWei },
        "Initiating burn transaction..."
      );

      const userWalletClient = createWalletClient({
        account: userAccount,
        chain,
        transport: http(rpcUrl),
      });

      const { request } = await publicClient.simulateContract({
        address: ONECURRENCY_ADDRESS as `0x${string}`,
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

    (e): AppError => {
      if (e instanceof AppError) {
        return e;
      }
      if (e instanceof HttpRequestError || e instanceof TimeoutError) {
        return handleNetworkError(e);
      }
      if (e instanceof ContractFunctionRevertedError) {
        return handleContractRevert(e, "burn");
      }
      return new InternalError(
        "An unhandled exception was caught during token burn.",
        { cause: e }
      );
    }
  );
}

/**
 * Transfers ONE tokens from one custodial wallet to another address
 * by decrypting the sender's private key and calling ERC-20 transfer().
 *
 * @param encryptedPrivateKey The sender's encrypted private key
 * @param toAddress The recipient's Ethereum address
 * @param amountWei The exact amount to transfer in Wei
 * @returns ResultAsync containing the confirmed transaction hash
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

      // Check sender has ETH for gas before attempting to simulate
      const TRANSFER_GAS_ESTIMATE = 65_000n;
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
        {
          from: senderAccount.address,
          to: toAddress,
          amountWei,
        },
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
        {
          txHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
        },
        "P2P transfer transaction successfully confirmed!"
      );

      return receipt.transactionHash;
    })(),

    (e): AppError => {
      if (e instanceof AppError) {
        return e;
      }
      if (e instanceof HttpRequestError || e instanceof TimeoutError) {
        return handleNetworkError(e);
      }
      if (e instanceof ContractFunctionRevertedError) {
        return handleContractRevert(e, "transfer");
      }
      return new InternalError(
        "An unhandled exception was caught during token transfer.",
        { cause: e }
      );
    }
  );
}

export function blacklistAddress(
  address: string
): ResultAsync<string, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      if (!isAddress(address)) {
        throw new InvalidAddressError(address);
      }
      logger.info({ address }, "Blacklisting address on-chain...");
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
    (e): AppError => {
      if (e instanceof AppError) {
        return e;
      }
      if (e instanceof HttpRequestError || e instanceof TimeoutError) {
        return handleNetworkError(e);
      }
      if (e instanceof ContractFunctionRevertedError) {
        return handleContractRevert(e, "blacklistAccount");
      }
      return new InternalError("Failed to blacklist address on-chain", {
        cause: e,
      });
    }
  );
}

export function unblacklistAddress(
  address: string
): ResultAsync<string, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      if (!isAddress(address)) {
        throw new InvalidAddressError(address);
      }
      logger.info({ address }, "Removing address from on-chain blacklist...");
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
    (e): AppError => {
      if (e instanceof AppError) {
        return e;
      }
      if (e instanceof HttpRequestError || e instanceof TimeoutError) {
        return handleNetworkError(e);
      }
      if (e instanceof ContractFunctionRevertedError) {
        return handleContractRevert(e, "unblacklistAccount");
      }
      return new InternalError("Failed to unblacklist address on-chain", {
        cause: e,
      });
    }
  );
}

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
    (e): AppError => {
      if (e instanceof AppError) {
        return e;
      }
      if (e instanceof HttpRequestError || e instanceof TimeoutError) {
        return handleNetworkError(e);
      }
      if (e instanceof ContractFunctionRevertedError) {
        return handleContractRevert(e, "seizeTokens");
      }
      return new InternalError("Failed to seize tokens on-chain", {
        cause: e,
      });
    }
  );
}
