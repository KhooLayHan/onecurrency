/**
 * Blockchain-related constants for on-chain operations.
 */

/** The Ethereum zero address — tokens minted from this address by convention */
export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as const;

/** Minimum confirmations before a transaction is considered confirmed on-chain */
export const MIN_CONFIRMATIONS = 1;

export const SEPOLIA_CHAIN_ID = 11_155_111;

export const HARDHAT_CHAIN_ID = 31_337;
