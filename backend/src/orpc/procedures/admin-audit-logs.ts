/**
 * Admin audit log procedures.
 *
 * Exposes `listAuditLogs` — a paginated, filterable view of the
 * `audit_logs` table joined with the actor's user record so the
 * UI can display a human-readable name and email for each event.
 *
 * @permission audit:read (held by both admin and compliance roles)
 */
import z from "zod";
import { db } from "@/src/db";
import { AuditLogRepository } from "@/src/repositories/audit-log.repository";
import { base } from "../context";
import { mapToORPCError } from "../errors";
import { requirePermission } from "../middleware";

const auditLogRepository = new AuditLogRepository(db);

/** Number of audit log entries returned per page. */
const AUDIT_LOGS_PAGE_SIZE = 25;

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
 * @input  page       - 1-based page number (default 1).
 * @input  search     - Optional text to search across action, entity type, actor name/email.
 * @input  action     - Optional exact action string to filter by.
 * @input  entityType - Optional entity type to filter by.
 * @input  dateFrom   - Optional ISO date for the inclusive lower bound of `createdAt`.
 * @input  dateTo     - Optional ISO date for the inclusive upper bound of `createdAt`.
 * @output Paginated list of `auditLogItemSchema` rows with actor info.
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
    const result = await auditLogRepository.listWithActor({
      page: input.page,
      pageSize: AUDIT_LOGS_PAGE_SIZE,
      search: input.search,
      action: input.action,
      entityType: input.entityType,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
    });
    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }

    return {
      items: result.value.items.map((row) => ({
        publicId: row.publicId,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId?.toString() ?? null,
        actorName: row.actorName,
        actorEmail: row.actorEmail,
        oldValues: (row.oldValues as Record<string, unknown>) ?? null,
        newValues: (row.newValues as Record<string, unknown>) ?? null,
        metadata: (row.metadata as Record<string, unknown>) ?? null,
        createdAt: row.createdAt,
      })),
      total: result.value.total,
      page: input.page,
      pageSize: AUDIT_LOGS_PAGE_SIZE,
    };
  });
