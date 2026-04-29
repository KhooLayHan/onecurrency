import {
  bigint,
  boolean,
  index,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const twoFactors = pgTable(
  "two_factor",
  {
    id: bigint("id", { mode: "bigint" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    userId: bigint("user_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    verified: boolean("verified").notNull().default(false),
  },
  (table) => [
    uniqueIndex("uq_two_factor_user_id").on(table.userId),
    index("idx_two_factor_user_id").on(table.userId),
  ]
);

export type TwoFactor = typeof twoFactors.$inferSelect;
