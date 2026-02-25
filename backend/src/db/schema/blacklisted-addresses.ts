import { sql } from "drizzle-orm";
import {
  bigint,
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

export const blacklistedAddresses = pgTable(
  "blacklisted_addresses",
  {
    id: bigint("id", { mode: "bigint" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    publicId: uuid("public_id").default(sql`uuidv7()`).notNull().unique(),
    address: varchar("address", { length: 42 }).notNull(),
    networkId: integer("network_id").references(() => networks.id),
    reason: text("reason").notNull(),
    source: varchar("source", { length: 100 }),
    addedByUserId: bigint("added_by_user_id", { mode: "bigint" }).references(
      () => users.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "chk_blacklist_address_format",
      sql`${table.address} ~* '^0x[a-fA-F0-9]{40}$'`
    ),
    uniqueIndex("uq_blacklist_address_network").on(
      sql`LOWER(${table.address})`,
      table.networkId
    ),
    index("idx_blacklist_network").on(table.networkId),
    index("idx_blacklist_source").on(table.source),
    index("idx_blacklist_active").on(
      sql`LOWER(${table.address})`,
      table.expiresAt
    ),
  ]
);

export type BlacklistedAddress = typeof blacklistedAddresses.$inferSelect;
export type NewBlacklistedAddress = typeof blacklistedAddresses.$inferInsert;
