import { ResultAsync } from "neverthrow";
import { InternalError } from "@/common/errors/infrastructure";
import type { Database } from "../db";
import { auditLogs } from "../db/schema/audit-logs";

type LogInput = {
  userId: bigint | null;
  action: string;
  entityType: string;
  entityId?: bigint;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export class AuditService {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  log(input: LogInput): ResultAsync<void, InternalError> {
    return ResultAsync.fromPromise(
      this.db
        .insert(auditLogs)
        .values({
          userId: input.userId,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          oldValues: input.oldValues ?? null,
          newValues: input.newValues ?? null,
          metadata: input.metadata ?? null,
        })
        .then((): void => {}),
      (e): InternalError =>
        new InternalError("Failed to write audit log", {
          cause: e,
          context: { action: input.action, entityType: input.entityType },
        })
    );
  }
}
