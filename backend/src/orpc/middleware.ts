import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { roles } from "@/src/db/schema/roles";
import { userRoles } from "@/src/db/schema/user-roles";
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

async function loadUserRoles(userId: string): Promise<string[]> {
  const rows = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, BigInt(userId)));
  return rows.map((r) => r.name);
}

export const requireRole = (...roleNames: string[]) =>
  base.middleware(async ({ context, next }) => {
    const session = context.session;
    if (!session?.userId) {
      throw new ORPCError("UNAUTHORIZED");
    }
    const userRoleList =
      context.userRoles ?? (await loadUserRoles(session.userId));

    const hasRole = roleNames.some((r) => userRoleList.includes(r));
    if (!hasRole) {
      throw new ORPCError("FORBIDDEN", {
        message: "Insufficient permissions",
      });
    }
    return next({ context: { session, userRoles: userRoleList } });
  });

export const requirePermission = (permission: string) =>
  base.middleware(async ({ context, next }) => {
    const session = context.session;
    if (!session?.userId) {
      throw new ORPCError("UNAUTHORIZED");
    }
    const rows = await db
      .select({ permissions: roles.permissions })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, BigInt(session.userId)));

    const allPermissions = rows.flatMap((r) => r.permissions as string[]);
    const hasPermission =
      allPermissions.includes("*") || allPermissions.includes(permission);

    if (!hasPermission) {
      throw new ORPCError("FORBIDDEN", {
        message: `Missing permission: ${permission}`,
      });
    }
    return next({ context: { session } });
  });
