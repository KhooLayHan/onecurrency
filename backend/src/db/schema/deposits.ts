import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  inet,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { transactionStatuses } from "./transaction-statuses";
import { users } from "./users";
import { wallets } from "./wallets";

export const deposits = pgTable(
  "deposits",
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
    stripeSessionId: varchar("stripe_session_id", { length: 255 })
      .notNull()
      .unique(),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", {
      length: 255,
    }).unique(),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    feeCents: bigint("fee_cents", { mode: "bigint" }).notNull().default(0n),
    netAmountCents: bigint("net_amount_cents", {
      mode: "bigint",
    }).generatedAlwaysAs(sql`amount_cents - fee_cents`),
    tokenAmount: numeric("token_amount", { precision: 78, scale: 0 }).notNull(),
    exchangeRate: numeric("exchange_rate", { precision: 19, scale: 8 })
      .notNull()
      .default("1.0"),
    blockchainTxId: bigint("blockchain_tx_id", { mode: "bigint" }),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).unique(),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    check("chk_deposits_amount_positive", sql`${table.amountCents} > 0`),
    check("chk_deposits_fee_nonnegative", sql`${table.feeCents} >= 0`),
    check(
      "chk_deposits_fee_lte_amount",
      sql`${table.feeCents} <= ${table.amountCents}`
    ),
    check("chk_deposits_token_positive", sql`${table.tokenAmount} > 0`),
    check(
      "chk_deposits_exchange_rate_positive",
      sql`${table.exchangeRate} > 0`
    ),
    index("idx_deposits_user").on(table.userId),
    index("idx_deposits_wallet").on(table.walletId),
    index("idx_deposits_status_created").on(table.statusId, table.createdAt),
    index("idx_deposits_stripe_session").on(table.stripeSessionId),
    index("idx_deposits_stripe_payment").on(table.stripePaymentIntentId),
    index("idx_deposits_blockchain_tx").on(table.blockchainTxId),
    index("idx_deposits_created").on(table.createdAt),
  ]
);

export type Deposit = typeof deposits.$inferSelect;
export type NewDeposit = typeof deposits.$inferInsert;
