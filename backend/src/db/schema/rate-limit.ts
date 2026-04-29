import {
  bigint,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const rateLimits = pgTable(
  "rate_limit",
  {
    id: bigint("id", { mode: "bigint" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    key: text("key").notNull(),
    count: integer("count").notNull().default(0),
    lastRequest: bigint("last_request", { mode: "bigint" }).notNull(),
  },
  (table) => [uniqueIndex("uq_rate_limit_key").on(table.key)]
);

export type RateLimit = typeof rateLimits.$inferSelect;
