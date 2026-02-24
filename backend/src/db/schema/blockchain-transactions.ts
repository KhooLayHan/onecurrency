import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { networks } from "./networks";
import { transactionTypes } from "./transaction-types";

export const blockchainTransactions = pgTable(
  "blockchain_transactions",
  {
    id: bigint("id", { mode: "bigint" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    publicId: uuid("public_id").default(sql`uuidv7()`).notNull().unique(),
    networkId: integer("network_id")
      .notNull()
      .references(() => networks.id),
    transactionTypeId: integer("transaction_type_id")
      .notNull()
      .references(() => transactionTypes.id),
    fromAddress: varchar("from_address", { length: 42 }).notNull(),
    toAddress: varchar("to_address", { length: 42 }).notNull(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }),
    blockHash: varchar("block_hash", { length: 66 }),
    amount: numeric("amount", { precision: 78, scale: 0 }).notNull(),
    nonce: bigint("nonce", { mode: "bigint" }),
    gasUsed: bigint("gas_used", { mode: "bigint" }),
    gasPriceWei: numeric("gas_price_wei", { precision: 78, scale: 0 }),
    isConfirmed: boolean("is_confirmed").notNull().default(false),
    confirmations: integer("confirmations").notNull().default(0),
    requiredConfirmations: integer("required_confirmations")
      .notNull()
      .default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (table) => [
    unique("uq_blockchain_tx_hash_network").on(table.txHash, table.networkId),
    check(
      "chk_blockchain_tx_hash_format",
      sql`${table.txHash} ~* '^0x[a-fA-F0-9]{64}$'`
    ),
    check(
      "chk_blockchain_from_address",
      sql`${table.fromAddress} ~* '^0x[a-fA-F0-9]{40}$'`
    ),
    check(
      "chk_blockchain_to_address",
      sql`${table.toAddress} ~* '^0x[a-fA-F0-9]{40}$'`
    ),
    check("chk_blockchain_amount_nonnegative", sql`${table.amount} >= 0`),
    check(
      "chk_blockchain_confirmations_nonnegative",
      sql`${table.confirmations} >= 0`
    ),
    check(
      "chk_blockchain_nonce_nonnegative",
      sql`${table.nonce} IS NULL OR ${table.nonce} >= 0`
    ),
    check(
      "chk_blockchain_required_confirmations",
      sql`${table.requiredConfirmations} > 0`
    ),
    index("idx_blockchain_tx_network").on(table.networkId),
    index("idx_blockchain_tx_type").on(table.transactionTypeId),
    index("idx_blockchain_tx_from").on(sql`LOWER(${table.fromAddress})`),
    index("idx_blockchain_tx_to").on(sql`LOWER(${table.toAddress})`),
    index("idx_blockchain_tx_block").on(table.networkId, table.blockNumber),
    index("idx_blockchain_tx_unconfirmed")
      .on(table.createdAt)
      .where(sql`${table.isConfirmed} = FALSE`),
    index("idx_blockchain_tx_nonce")
      .on(table.networkId, table.fromAddress, table.nonce)
      .where(sql`${table.isConfirmed} = FALSE`),
  ]
);

export type BlockchainTransaction = typeof blockchainTransactions.$inferSelect;
export type NewBlockchainTransaction =
  typeof blockchainTransactions.$inferInsert;
