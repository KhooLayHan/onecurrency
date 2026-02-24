import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sessions } from "./sessions";
import { users } from "./users";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigint("id", { mode: "bigint" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    publicId: uuid("public_id").default(sql`uuidv7()`).notNull().unique(),
    userId: bigint("user_id", { mode: "bigint" }).references(() => users.id, {
      onDelete: "set null",
    }),
    sessionId: bigint("session_id", { mode: "bigint" }).references(
      () => sessions.id,
      { onDelete: "set null" }
    ),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: bigint("entity_id", { mode: "bigint" }),
    oldValues: jsonb("old_values"),
    newValues: jsonb("new_values"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_audit_user").on(table.userId),
    index("idx_audit_session").on(table.sessionId),
    index("idx_audit_entity").on(table.entityType, table.entityId),
    index("idx_audit_action").on(table.action),
    index("idx_audit_created").on(table.createdAt),
    index("idx_audit_recent")
      .on(table.entityType, table.createdAt)
      .where(sql`${table.createdAt} > NOW() - INTERVAL '30 days'`),
    index("idx_audit_metadata_gin").using("gin", sql`${table.metadata}`),
  ]
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
