import { ResultAsync } from "neverthrow";
import type { InternalError } from "@/common/errors/infrastructure";

export function dbExec(
  promise: Promise<unknown>,
  error: (e: unknown) => InternalError
): ResultAsync<void, InternalError> {
  return ResultAsync.fromPromise(
    promise.then(() => {
      return;
    }),
    error
  );
}
