/**
 * Transaction Type IDs mirror the `transaction_types` table seeded in db/seed/transaction-types.ts
 * Values: Mint=1, Burn=2, Transfer=3
 */
export const TRANSACTION_TYPE = {
  MINT: 1,
  BURN: 2,
  TRANSFER: 3,
} as const;

export type TransactionTypeId =
  (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE];
