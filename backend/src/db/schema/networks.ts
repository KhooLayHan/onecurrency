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
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const networks = pgTable(
  "networks",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid("public_id").default(sql`uuidv7()`).notNull().unique(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    chainId: bigint("chain_id", { mode: "bigint" }).notNull().unique(),
    rpcUrl: text("rpc_url"),
    explorerUrl: text("explorer_url"),
    contractAddress: varchar("contract_address", { length: 42 }),
    isTestnet: boolean("is_testnet").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "chk_networks_contract_address_format",
      sql`${table.contractAddress} IS NULL OR ${table.contractAddress} ~* '^0x[a-fA-F0-9]{40}$'`
    ),
    index("idx_networks_active").on(table.isActive),
  ]
);

export type Network = typeof networks.$inferSelect;
export type NewNetwork = typeof networks.$inferInsert;
