/**
 * Audit log repository.
 *
 * Data access for the `audit_logs` table. The primary query joins against
 * `users` to surface the actor's name and email for the admin review UI.
 *
 * Filter-condition building and end-of-day date normalisation are encapsulated
 * here so the oRPC procedure layer has no Drizzle dependency.
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
import { ResultAsync } from "neverthrow";
import { InternalError } from "@/common/errors/infrastructure";
import type { Database } from "../db";
import { auditLogs } from "../db/schema/audit-logs";
import { users } from "../db/schema/users";

type AuditLogListFilters = {
  page: number;
  pageSize: number;
  search?: string;
  action?: string;
  entityType?: string;
  /** ISO date string (`YYYY-MM-DD`) for the inclusive lower bound. */
  dateFrom?: string;
  /** ISO date string (`YYYY-MM-DD`) for the inclusive upper bound. */
  dateTo?: string;
};

/** End-of-day time components for inclusive upper-bound date filtering. */
const END_OF_DAY_HOURS = 23;
const END_OF_DAY_MINUTES = 59;
const END_OF_DAY_SECONDS = 59;
const END_OF_DAY_MS = 999;

/**
 * A single row returned by `listWithActor`.
 * `entityId` is the raw `bigint` from the DB — callers convert to string
 * for serialisation.
 */
export type AuditLogWithActor = {
  publicId: string;
  action: string;
  entityType: string;
  entityId: bigint | null;
  oldValues: unknown;
  newValues: unknown;
  metadata: unknown;
  createdAt: Date;
  actorName: string | null;
  actorEmail: string | null;
};

export class AuditLogRepository {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  /**
   * Builds the SQL condition array from the provided filter inputs.
   * Returns `undefined` when no filters are active so callers can omit
   * the `.where()` clause entirely.
   */
  private buildConditions(filters: AuditLogListFilters): SQL[] | undefined {
    const conditions: SQL[] = [];

    if (filters.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(auditLogs.action, term),
          ilike(auditLogs.entityType, term),
          ilike(users.name, term),
          ilike(users.email, term)
        ) as SQL
      );
    }
    if (filters.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }
    if (filters.entityType) {
      conditions.push(eq(auditLogs.entityType, filters.entityType));
    }
    if (filters.dateFrom) {
      conditions.push(gte(auditLogs.createdAt, new Date(filters.dateFrom)));
    }
    if (filters.dateTo) {
      const end = new Date(filters.dateTo);
      end.setUTCHours(
        END_OF_DAY_HOURS,
        END_OF_DAY_MINUTES,
        END_OF_DAY_SECONDS,
        END_OF_DAY_MS
      );
      conditions.push(lte(auditLogs.createdAt, end));
    }

    return conditions.length > 0 ? conditions : undefined;
  }

  /**
   * Returns a paginated list of audit log entries joined with the actor's
   * user record, ordered newest first.
   *
   * Count and data queries run in parallel via `Promise.all`.
   *
   * @param filters - Pagination parameters and optional filter criteria.
   * @returns Paginated `AuditLogWithActor` rows and total count.
   */
  listWithActor(
    filters: AuditLogListFilters
  ): ResultAsync<{ items: AuditLogWithActor[]; total: number }, InternalError> {
    return ResultAsync.fromPromise(
      (async () => {
        const offset = (filters.page - 1) * filters.pageSize;
        const conditionList = this.buildConditions(filters);
        const where = conditionList ? and(...conditionList) : undefined;

        const joined = this.db
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

        const countJoined = this.db
          .select({ count: count(auditLogs.id) })
          .from(auditLogs)
          .leftJoin(users, eq(auditLogs.userId, users.id));

        const [[totalResult], rows] = await Promise.all([
          where ? countJoined.where(where) : countJoined,
          (where ? joined.where(where) : joined)
            .orderBy(desc(auditLogs.createdAt))
            .limit(filters.pageSize)
            .offset(offset),
        ]);

        return {
          items: rows.map((row) => ({
            publicId: row.publicId,
            action: row.action,
            entityType: row.entityType,
            entityId: row.entityId,
            oldValues: row.oldValues,
            newValues: row.newValues,
            metadata: row.metadata,
            createdAt: row.createdAt,
            actorName: row.actorName ?? null,
            actorEmail: row.actorEmail ?? null,
          })),
          total: totalResult?.count ?? 0,
        };
      })(),
      (e): InternalError =>
        new InternalError("Failed to list audit log entries", { cause: e })
    );
  }
}
