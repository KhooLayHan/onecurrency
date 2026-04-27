import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { blockchainTransactions } from "./blockchain-transactions";
import { transactionStatuses } from "./transaction-statuses";
import { users } from "./users";
import { wallets } from "./wallets";

export const transfers = pgTable(
  "transfers",
  {
    id: bigint("id", { mode: "bigint" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    publicId: uuid("public_id").default(sql`uuidv7()`).notNull().unique(),
    senderUserId: bigint("sender_user_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id),
    receiverUserId: bigint("receiver_user_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id),
    senderWalletId: bigint("sender_wallet_id", { mode: "bigint" })
      .notNull()
      .references(() => wallets.id),
    receiverWalletId: bigint("receiver_wallet_id", { mode: "bigint" })
      .notNull()
      .references(() => wallets.id),
    statusId: integer("status_id")
      .notNull()
      .references(() => transactionStatuses.id),
    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    feeCents: bigint("fee_cents", { mode: "bigint" }).notNull().default(0n),
    netAmountCents: bigint("net_amount_cents", {
      mode: "bigint",
    }).generatedAlwaysAs(sql`amount_cents - fee_cents`),
    tokenAmount: numeric("token_amount", { precision: 78, scale: 0 }).notNull(),
    blockchainTxId: bigint("blockchain_tx_id", { mode: "bigint" }).references(
      () => blockchainTransactions.id
    ),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    check("chk_transfers_amount_positive", sql`${table.amountCents} > 0`),
    check("chk_transfers_fee_nonnegative", sql`${table.feeCents} >= 0`),
    check(
      "chk_transfers_fee_lte_amount",
      sql`${table.feeCents} <= ${table.amountCents}`
    ),
    check("chk_transfers_token_positive", sql`${table.tokenAmount} > 0`),
    check(
      "chk_transfers_no_self_transfer",
      sql`${table.senderUserId} != ${table.receiverUserId}`
    ),
    index("idx_transfers_sender").on(table.senderUserId),
    index("idx_transfers_receiver").on(table.receiverUserId),
    index("idx_transfers_status").on(table.statusId),
    index("idx_transfers_blockchain_tx").on(table.blockchainTxId),
    index("idx_transfers_created").on(table.createdAt),
  ]
);

export type Transfer = typeof transfers.$inferSelect;
export type NewTransfer = typeof transfers.$inferInsert;
