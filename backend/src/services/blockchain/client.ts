/**
 * Blockchain client initialization.
 *
 * Sets up the viem public client (for reading data and simulating transactions)
 * and the operator wallet client (the "relayer" that signs and broadcasts
 * transactions on behalf of the platform).
 *
 * Both clients are singletons — import them wherever you need to interact
 * with the chain rather than creating new instances per request.
 */
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat, sepolia } from "viem/chains";
import { env } from "../../env";
import { logger } from "../../lib/logger";

// Determine the active chain and RPC endpoint from the runtime environment
const isProd = env.NODE_ENV === "production";

/** The viem chain object used by all clients in this module. */
export const chain = isProd ? sepolia : hardhat;

/** The RPC URL for the active chain. */
export const rpcUrl = isProd ? env.SEPOLIA_RPC_URL : env.LOCAL_RPC_URL;

// The operator private key must be present at startup — fail fast if missing
if (!env.SEPOLIA_PRIVATE_KEY) {
  logger.fatal(
    "SEPOLIA_PRIVATE_KEY is missing from environment! Cannot initialize minter."
  );
  throw new Error("SEPOLIA_PRIVATE_KEY is required for blockchain service");
}

// Normalise the key: viem requires a 0x-prefixed string
const formattedPrivateKey = env.SEPOLIA_PRIVATE_KEY.startsWith("0x")
  ? env.SEPOLIA_PRIVATE_KEY
  : `0x${env.SEPOLIA_PRIVATE_KEY}`;

/** The operator account derived from the platform private key. */
export const account = privateKeyToAccount(
  formattedPrivateKey as `0x${string}`
);

/**
 * Public client — used for read-only operations (balanceOf, simulateContract)
 * and for waiting on transaction receipts.
 */
export const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
});

/**
 * Operator wallet client — used to sign and broadcast write transactions
 * (mint, blacklist, seize) from the platform operator account.
 */
export const walletClient = createWalletClient({
  account,
  chain,
  transport: http(rpcUrl),
});

/** Numeric chain ID of the currently active chain (exported for callers that need it). */
export const activeChainId: number = chain.id;
