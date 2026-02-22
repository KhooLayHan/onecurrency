import { db } from "@/src/db";
import { transactionTypes } from "../schema/transactionTypes";

export const seedTransactionTypes = async () => {
  await db.insert(transactionTypes).values([
    { name: "Mint", description: "Tokens minted to address" },
    { name: "Burn", description: "Tokens burned from address" },
    { name: "Transfer", description: "Tokens transferred between addresses" },
  ]);
};
