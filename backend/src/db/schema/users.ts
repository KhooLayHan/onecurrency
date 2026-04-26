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
import { kycStatuses } from "./kyc-statuses";

const MAX_DEPOSIT_LIMIT_CENTS: bigint = 100_000n;

export const users = pgTable(
  "users",
  {
    // Better-Auth core columns
    id: bigint("id", { mode: "bigint" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    // OneCurrency extensions
    publicId: uuid("public_id").default(sql`uuidv7()`).notNull().unique(),
    kycStatusId: integer("kyc_status_id")
      .notNull()
      .default(1)
      .references(() => kycStatuses.id),
    kycVerifiedAt: timestamp("kyc_verified_at", { withTimezone: true }),
    depositLimitCents: bigint("deposit_limit_cents", { mode: "bigint" })
      .notNull()
      .default(MAX_DEPOSIT_LIMIT_CENTS),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    // Unique email for active users only
    uniqueIndex("uq_users_email_active")
      .on(table.email)
      .where(sql`${table.deletedAt} IS NULL`),
    check("chk_deposit_limit", sql`${table.depositLimitCents} >= 0`),
    index("idx_users_kyc_status").on(table.kycStatusId),
    index("idx_users_created").on(table.createdAt),
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
