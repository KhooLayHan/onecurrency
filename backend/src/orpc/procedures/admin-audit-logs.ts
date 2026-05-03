/**
 * Admin audit log procedures.
 *
 * Exposes `listAuditLogs` — a paginated, filterable view of the
 * `audit_logs` table joined with the actor's user record so the
 * UI can display a human-readable name and email for each event.
 *
 * @permission audit:read (held by both admin and compliance roles)
 */
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  type SQL,
} from "drizzle-orm";
import z from "zod";
import { db } from "@/src/db";
import { auditLogs } from "@/src/db/schema/audit-logs";
import { users } from "@/src/db/schema/users";
import { base } from "../context";
import { requirePermission } from "../middleware";

/** Number of audit log entries returned per page. */
const AUDIT_LOGS_PAGE_SIZE = 25;

/** End-of-day time components for inclusive upper-bound date filtering. */
const END_OF_DAY_HOURS = 23;
const END_OF_DAY_MINUTES = 59;
const END_OF_DAY_SECONDS = 59;
const END_OF_DAY_MS = 999;

const auditLogItemSchema = z.object({
  publicId: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  actorName: z.string().nullable(),
  actorEmail: z.string().nullable(),
  oldValues: z.record(z.string(), z.unknown()).nullable(),
  newValues: z.record(z.string(), z.unknown()).nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.date(),
});

/**
 * Returns a paginated list of audit log entries, newest first.
 *
 * Supports filtering by free-text search (actor name/email, action,
 * entity type), a specific action string, entity type, and date range.
 *
 * @permission audit:read
 */
export const listAuditLogs = base
  .use(requirePermission("audit:read"))
  .input(
    z.object({
      page: z.number().int().min(1).default(1),
      search: z.string().trim().optional(),
      action: z.string().optional(),
      entityType: z.string().optional(),
      dateFrom: z.iso.date().optional(),
      dateTo: z.iso.date().optional(),
    })
  )
  .output(
    z.object({
      items: z.array(auditLogItemSchema),
      total: z.number(),
      page: z.number(),
      pageSize: z.number(),
    })
  )
  .handler(async ({ input }) => {
    const offset = (input.page - 1) * AUDIT_LOGS_PAGE_SIZE;
    const conditions: SQL[] = [];

    if (input.search) {
      const term = `%${input.search}%`;
      conditions.push(
        or(
          ilike(auditLogs.action, term),
          ilike(auditLogs.entityType, term),
          ilike(users.name, term),
          ilike(users.email, term)
        ) as SQL
      );
    }
    if (input.action) {
      conditions.push(eq(auditLogs.action, input.action));
    }
    if (input.entityType) {
      conditions.push(eq(auditLogs.entityType, input.entityType));
    }
    if (input.dateFrom) {
      conditions.push(gte(auditLogs.createdAt, new Date(input.dateFrom)));
    }
    if (input.dateTo) {
      const end = new Date(input.dateTo);
      end.setUTCHours(
        END_OF_DAY_HOURS,
        END_OF_DAY_MINUTES,
        END_OF_DAY_SECONDS,
        END_OF_DAY_MS
      );
      conditions.push(lte(auditLogs.createdAt, end));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const joined = db
      .select({
        publicId: auditLogs.publicId,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        oldValues: auditLogs.oldValues,
        newValues: auditLogs.newValues,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        actorName: users.name,
        actorEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id));

    const countJoined = db
      .select({ count: count(auditLogs.id) })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id));

    const [[totalResult], rows] = await Promise.all([
      where ? countJoined.where(where) : countJoined,
      (where ? joined.where(where) : joined)
        .orderBy(desc(auditLogs.createdAt))
        .limit(AUDIT_LOGS_PAGE_SIZE)
        .offset(offset),
    ]);

    return {
      items: rows.map((row) => ({
        publicId: row.publicId,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId?.toString() ?? null,
        actorName: row.actorName ?? null,
        actorEmail: row.actorEmail ?? null,
        oldValues: (row.oldValues as Record<string, unknown>) ?? null,
        newValues: (row.newValues as Record<string, unknown>) ?? null,
        metadata: (row.metadata as Record<string, unknown>) ?? null,
        createdAt: row.createdAt,
      })),
      total: totalResult?.count ?? 0,
      page: input.page,
      pageSize: AUDIT_LOGS_PAGE_SIZE,
    };
  });
