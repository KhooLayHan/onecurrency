/**
 * Blockchain client initialization.
 *
 * Exports two categories of client:
 *
 * **Read-only (always available)**
 * - `publicClient` — viem public client for `balanceOf`, `simulateContract`,
 *   and `waitForTransactionReceipt`. Safe to import in any module, including
 *   contexts where no private key is configured (e.g. read-only balance checks
 *   in local dev without a Sepolia key).
 *
 * **Write-only (lazy, key required)**
 * - `getOperatorAccount()` — returns the `{ account, walletClient }` pair
 *   needed to sign and broadcast transactions. Throws at call time (not at
 *   import time) if `SEPOLIA_PRIVATE_KEY` is absent, so importing this module
 *   never blocks read-only callers.
 *
 * Chain selection follows `NODE_ENV`: production → Sepolia, everything else
 * → Hardhat local node.
 */
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat, sepolia } from "viem/chains";
import { env } from "../../env";
import { logger } from "../../lib/logger";

const isProd = env.NODE_ENV === "production";

/** The viem chain object for the active environment. */
export const chain = isProd ? sepolia : hardhat;

/** The RPC URL for the active chain. */
export const rpcUrl = isProd ? env.SEPOLIA_RPC_URL : env.LOCAL_RPC_URL;

/**
 * Public client — used for read-only operations (`balanceOf`, `simulateContract`)
 * and for waiting on transaction receipts.
 *
 * Initialised unconditionally so modules that only read chain state (e.g.
 * `balance.ts`) can import it without requiring `SEPOLIA_PRIVATE_KEY`.
 */
export const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
});

/** Numeric chain ID of the currently active chain. */
export const activeChainId: number = chain.id;

/**
 * Returns the operator account and wallet client needed to sign and broadcast
 * write transactions (mint, burn, blacklist, seize).
 *
 * Validation and key derivation happen here — at call time — rather than at
 * module evaluation time. This means importing `client.ts` never fails due to
 * a missing key, keeping read-only paths (e.g. `balance.ts`) independent.
 *
 * @returns An object containing the derived `account` and a `walletClient`
 *          configured for the active chain.
 * @throws `Error` immediately if `SEPOLIA_PRIVATE_KEY` is not set in the
 *         environment, preventing silent no-ops for write operations.
 */
export function getOperatorAccount() {
  if (!env.SEPOLIA_PRIVATE_KEY) {
    logger.fatal(
      "SEPOLIA_PRIVATE_KEY is missing from environment! Cannot sign transactions."
    );
    throw new Error("SEPOLIA_PRIVATE_KEY is required for write operations");
  }

  const formattedKey = env.SEPOLIA_PRIVATE_KEY.startsWith("0x")
    ? env.SEPOLIA_PRIVATE_KEY
    : `0x${env.SEPOLIA_PRIVATE_KEY}`;

  const account = privateKeyToAccount(formattedKey as `0x${string}`);

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  return { account, walletClient };
}
