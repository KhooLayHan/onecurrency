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
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { blockchainTransactions } from "./blockchain-transactions";
import { transactionStatuses } from "./transaction-statuses";
import { users } from "./users";
import { wallets } from "./wallets";

export const withdrawals = pgTable(
  "withdrawals",
  {
    id: bigint("id", { mode: "bigint" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    publicId: uuid("public_id").default(sql`uuidv7()`).notNull().unique(),
    userId: bigint("user_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id),
    walletId: bigint("wallet_id", { mode: "bigint" })
      .notNull()
      .references(() => wallets.id),
    statusId: integer("status_id")
      .notNull()
      .references(() => transactionStatuses.id),
    tokenAmount: numeric("token_amount", { precision: 78, scale: 0 }).notNull(),
    fiatAmountCents: bigint("fiat_amount_cents", { mode: "bigint" }).notNull(),
    feeCents: bigint("fee_cents", { mode: "bigint" }).notNull().default(0n),
    netAmountCents: bigint("net_amount_cents", {
      mode: "bigint",
    }).generatedAlwaysAs(sql`fiat_amount_cents - fee_cents`),
    exchangeRate: numeric("exchange_rate", { precision: 19, scale: 8 })
      .notNull()
      .default("1.0"),
    payoutMethod: varchar("payout_method", { length: 50 }),
    payoutReference: text("payout_reference"),
    blockchainTxId: bigint("blockchain_tx_id", { mode: "bigint" }).references(
      () => blockchainTransactions.id
    ),
    stripeTransferId: varchar("stripe_transfer_id", { length: 255 }),
    stripePayoutId: varchar("stripe_payout_id", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    check("chk_withdrawal_token_positive", sql`${table.tokenAmount} > 0`),
    check("chk_withdrawal_fiat_positive", sql`${table.fiatAmountCents} > 0`),
    check("chk_withdrawal_fee_nonnegative", sql`${table.feeCents} >= 0`),
    check(
      "chk_withdrawal_fee_lte_fiat",
      sql`${table.feeCents} <= ${table.fiatAmountCents}`
    ),
    index("idx_withdrawals_user").on(table.userId),
    index("idx_withdrawals_wallet").on(table.walletId),
    index("idx_withdrawals_status").on(table.statusId),
    index("idx_withdrawals_blockchain_tx").on(table.blockchainTxId),
    index("idx_withdrawals_created").on(table.createdAt),
    uniqueIndex("uq_withdrawals_stripe_transfer_id")
      .on(table.stripeTransferId)
      .where(sql`${table.stripeTransferId} IS NOT NULL`),
    uniqueIndex("uq_withdrawals_stripe_payout_id")
      .on(table.stripePayoutId)
      .where(sql`${table.stripePayoutId} IS NOT NULL`),
  ]
);

export type Withdrawal = typeof withdrawals.$inferSelect;
export type NewWithdrawal = typeof withdrawals.$inferInsert;
