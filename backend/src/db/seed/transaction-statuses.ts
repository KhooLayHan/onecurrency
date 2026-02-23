import { db } from "@/src/db";
import { transactionStatuses } from "../schema/transaction-statuses";

export const seedTransactionStatuses = async (): Promise<void> => {
  await db
    .insert(transactionStatuses)
    .values([
      {
        name: "Pending",
        description: "Transaction initiated, awaiting processing",
      },
      { name: "Processing", description: "Transaction being processed" },
      { name: "Completed", description: "Transaction successfully completed" },
      { name: "Failed", description: "Transaction failed" },
      { name: "Refunded", description: "Transaction refunded" },
    ])
    .onConflictDoNothing({ target: transactionStatuses.name });
};
