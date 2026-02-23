import { db } from "@/src/db";
import { transactionTypes } from "../schema/transaction-types";

export const seedTransactionTypes = async (): Promise<void> => {
  await db
    .insert(transactionTypes)
    .values([
      { name: "Mint", description: "Tokens minted to address" },
      { name: "Burn", description: "Tokens burned from address" },
      { name: "Transfer", description: "Tokens transferred between addresses" },
    ])
    .onConflictDoNothing({ target: transactionTypes.name });
};
