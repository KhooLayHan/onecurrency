import { os } from "@orpc/server";

export type ORPCContext = {
  session: { userId: string } | null;
};

/**
 * Base oRPC builder with the app-wide context type.
 * All procedures and middleware are built from this.
 */
export const base = os.$context<ORPCContext>();
