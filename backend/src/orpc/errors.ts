import { ORPCError } from "@orpc/server";
import type { AppError } from "@/common/errors/base";

/**
 * Converts a typed AppError into an ORPCError so oRPC's handler
 * serialises the correct HTTP status code and structured body.
 */
export function mapToORPCError(
  error: AppError
): ORPCError<string, ReturnType<AppError["toResponse"]>["error"]> {
  return new ORPCError(error.code, {
    status: error.statusCode as number,
    message: error.message,
    data: error.toResponse().error,
  });
}
