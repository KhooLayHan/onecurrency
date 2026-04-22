import { ORPCError } from "@orpc/server";
import { base } from "./context";

/**
 * oRPC middleware that requires an authenticated session.
 * Throws UNAUTHORIZED when no session exists.
 * Downstream handlers receive `context.session` narrowed to `{ userId: number }`.
 */
export const requireAuth = base.middleware(({ context, next }) => {
  const session = context.session;
  if (!session?.userId) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return next({ context: { session } });
});
