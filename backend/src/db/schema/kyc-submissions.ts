import { sql } from "drizzle-orm";
import {
  bigint,
  date,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { kycStatuses } from "./kyc-statuses";
import { users } from "./users";

export const kycSubmissions = pgTable(
  "kyc_submissions",
  {
    id: bigint("id", { mode: "bigint" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    publicId: uuid("public_id").default(sql`uuidv7()`).notNull().unique(),
    userId: bigint("user_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // KYC status at the time of submission (always PENDING on insert)
    kycStatusId: integer("kyc_status_id")
      .notNull()
      .references(() => kycStatuses.id),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    dateOfBirth: date("date_of_birth").notNull(),
    nationality: varchar("nationality", { length: 2 }).notNull(),
    documentType: varchar("document_type", { length: 20 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_kyc_submissions_user").on(table.userId),
    index("idx_kyc_submissions_submitted").on(table.id),
  ]
);

export type KycSubmission = typeof kycSubmissions.$inferSelect;
export type NewKycSubmission = typeof kycSubmissions.$inferInsert;
