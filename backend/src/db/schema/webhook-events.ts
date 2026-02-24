import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: bigint("id", { mode: "bigint" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    publicId: uuid("public_id").default(sql`uuidv7()`).notNull().unique(),
    stripeEventId: varchar("stripe_event_id", { length: 255 })
      .notNull()
      .unique(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    apiVersion: varchar("api_version", { length: 20 }),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    processingError: text("processing_error"),
    retryCount: integer("retry_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("chk_webhook_retry_count", sql`${table.retryCount} >= 0`),
    index("idx_webhook_event_type").on(table.eventType),
    index("idx_webhook_stripe_event").on(table.stripeEventId),
    index("idx_webhook_created").on(table.createdAt),
    index("idx_webhook_unprocessed")
      .on(table.createdAt)
      .where(sql`${table.processedAt} IS NULL`),
    index("idx_webhook_failed")
      .on(table.createdAt)
      .where(sql`${table.processingError} IS NOT NULL`),
  ]
);

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
