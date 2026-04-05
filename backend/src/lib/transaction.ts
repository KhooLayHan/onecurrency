import { ResultAsync } from "neverthrow";
import { AppError } from "@/common/errors/base";
import { InternalError } from "@/common/errors/infrastructure";
import type { Database } from "../db";

/**
 * Wraps a ResultAsync-producing function in a single database transaction.
 *
 * If the inner ResultAsync resolves to Err, the error is thrown to trigger
 * a rollback. The outer fromPromise re-catches it and passes it through.
 * Unknown errors are wrapped in InternalError.
 */
export function withTransaction<T, E extends AppError>(
  database: Database,
  fn: (tx: Database) => ResultAsync<T, E>
): ResultAsync<T, AppError> {
  return ResultAsync.fromPromise(
    database.transaction(async (tx) => {
      const result = await fn(tx as unknown as Database);

      if (result.isErr()) {
        throw result.error;
      }

      return result.value;
    }),
    (e): AppError =>
      e instanceof AppError
        ? e
        : new InternalError("Database transaction failed", { cause: e })
  );
}
