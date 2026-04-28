import { sql } from "drizzle-orm";
import {
  bigint,
  date,
  index,
  integer,
  pgTable,
  text,
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
    kycStatusId: integer("kyc_status_id")
      .notNull()
      .references(() => kycStatuses.id),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    dateOfBirth: date("date_of_birth").notNull(),
    nationality: varchar("nationality", { length: 2 }).notNull(),
    documentType: varchar("document_type", { length: 20 }).notNull(),
    // R2 object keys — set when user uploads files
    documentFrontKey: varchar("document_front_key", { length: 500 }),
    documentBackKey: varchar("document_back_key", { length: 500 }),
    selfieKey: varchar("selfie_key", { length: 500 }),
    // Review fields — set by admin/compliance
    rejectionReason: text("rejection_reason"),
    reviewedByUserId: bigint("reviewed_by_user_id", {
      mode: "bigint",
    }).references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_kyc_submissions_user").on(table.userId),
    index("idx_kyc_submissions_status").on(table.kycStatusId),
    index("idx_kyc_submissions_submitted").on(table.id),
  ]
);

export type KycSubmission = typeof kycSubmissions.$inferSelect;
export type NewKycSubmission = typeof kycSubmissions.$inferInsert;
