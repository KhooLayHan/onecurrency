/**
 * Transaction Status IDs mirror the `transaction_statuses` table seeded in db/seed/transaction-statuses.ts
 * Values: Pending=1, Processing=2, Completed=3, Failed=4, Refunded=5
 */
export const TRANSACTION_STATUS = {
  PENDING: 1,
  PROCESSING: 2,
  COMPLETED: 3,
  FAILED: 4,
  REFUNDED: 5,
} as const;

export type TransactionStatusId =
  (typeof TRANSACTION_STATUS)[keyof typeof TRANSACTION_STATUS];
