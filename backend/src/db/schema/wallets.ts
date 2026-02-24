import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { networks } from "./networks";
import { users } from "./users";

export const wallets = pgTable(
  "wallets",
  {
    id: bigint("id", { mode: "bigint" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    publicId: uuid("public_id").default(sql`uuidv7()`).notNull().unique(),
    userId: bigint("user_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    networkId: integer("network_id")
      .notNull()
      .references(() => networks.id),
    address: varchar("address", { length: 42 }).notNull(),
    label: varchar("label", { length: 100 }),
    isPrimary: boolean("is_primary").notNull().default(false),
    walletType: varchar("wallet_type", { length: 20 })
      .notNull()
      .default("EXTERNAL"),
    providerName: varchar("provider_name", { length: 50 }),
    encryptedPrivateKey: text("encrypted_private_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "chk_wallets_address_format",
      sql`${table.address} ~* '^0x[a-fA-F0-9]{40}$'`
    ),
    check(
      "chk_wallets_type",
      sql`${table.walletType} IN ('CUSTODIAL', 'EXTERNAL')`
    ),
    uniqueIndex("uq_wallets_primary")
      .on(table.userId, table.networkId)
      .where(sql`${table.isPrimary} = TRUE AND ${table.deletedAt} IS NULL`),
    uniqueIndex("uq_idx_wallets_address_network")
      .on(sql`LOWER(${table.address})`, table.networkId)
      .where(sql`${table.deletedAt} IS NULL`),
    index("idx_wallets_user")
      .on(table.userId)
      .where(sql`${table.deletedAt} IS NULL`),
    index("idx_wallets_network").on(table.networkId),
    index("idx_wallets_type").on(table.walletType),
    index("idx_wallets_provider").on(table.providerName),
  ]
);

export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;
