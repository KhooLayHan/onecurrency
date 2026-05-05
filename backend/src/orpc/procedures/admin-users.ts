/**
 * Admin user management procedures.
 *
 * Exposes five oRPC procedures for the admin user management UI:
 *
 * - `listAdminUsers`         — paginated, filterable user list.
 * - `getAdminUser`           — full profile for a single user.
 * - `updateUserDepositLimit` — adjusts a user's per-deposit spending cap.
 * - `suspendUser`            — soft-deletes the account and invalidates all sessions.
 * - `restoreUser`            — reinstates a previously suspended account.
 *
 * All procedures require the appropriate `user:*` permission enforced by the
 * `requirePermission` middleware. Mutations are recorded in the audit log via
 * `AuditService`.
 */
import { ORPCError } from "@orpc/server";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  type SQL,
} from "drizzle-orm";
import z from "zod";
import { db } from "@/src/db";
import { roles } from "@/src/db/schema/roles";
import { sessions } from "@/src/db/schema/sessions";
import { userRoles } from "@/src/db/schema/user-roles";
import { users } from "@/src/db/schema/users";
import { AuditService } from "@/src/services/audit.service";
import { base } from "../context";
import { mapToORPCError } from "../errors";
import { requirePermission } from "../middleware";

const auditService = new AuditService(db);

/** Default page size for the admin user list. */
const ADMIN_USERS_PAGE_SIZE = 20;

/** Maximum valid KYC status ID — used to bound the filter input. */
const MAX_KYC_STATUS_ID = 5;

/**
 * Output schema for a single row in the admin user list.
 * Contains summary fields suitable for a table view.
 */
const adminUserListItemSchema = z.object({
  publicId: z.string(),
  name: z.string(),
  email: z.string(),
  kycStatusId: z.number(),
  depositLimitCents: z.number(),
  roles: z.array(z.string()),
  createdAt: z.date(),
  deletedAt: z.date().nullable(),
});

/**
 * Output schema for the admin user detail view.
 * Extends the list schema with fields that are expensive to compute at
 * list scale (e.g. `emailVerified`, `kycVerifiedAt`, `updatedAt`).
 */
const adminUserDetailSchema = z.object({
  publicId: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  kycStatusId: z.number(),
  kycVerifiedAt: z.date().nullable(),
  depositLimitCents: z.number(),
  roles: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

/**
 * Batch-fetches role names for a list of user IDs in a single query and
 * returns a `Map<userId, roleNames[]>` keyed by stringified user ID.
 *
 * Returning an empty map immediately when `userIds` is empty avoids an
 * unnecessary DB round-trip on pages with no results.
 *
 * @param userIds - Array of bigint user primary keys to fetch roles for.
 * @returns Map from user ID string to the list of role names assigned to that user.
 */
async function fetchRolesForUsers(
  userIds: bigint[]
): Promise<Map<string, string[]>> {
  if (userIds.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({
      userId: userRoles.userId,
      roleName: roles.name,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(inArray(userRoles.userId, userIds));

  const map = new Map<string, string[]>();
  for (const row of rows) {
    const key = row.userId.toString();
    const existing = map.get(key) ?? [];
    existing.push(row.roleName);
    map.set(key, existing);
  }
  return map;
}

/**
 * Fetches a single user row by its public UUID or throws a `NOT_FOUND` error.
 *
 * Used as a shared guard by all mutation procedures to ensure the target user
 * exists before attempting any update.
 *
 * @param publicId - The user's UUID public identifier.
 * @returns The full Drizzle user row.
 * @throws `ORPCError("NOT_FOUND")` when no user matches the given public ID.
 */
async function findUserByPublicId(publicId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.publicId, publicId))
    .limit(1);

  if (!user) {
    throw new ORPCError("NOT_FOUND", { message: "User not found" });
  }
  return user;
}

/**
 * Returns a paginated list of users, optionally filtered by name/email search,
 * KYC status, or assigned role.
 *
 * When a `role` filter is provided, the procedure first resolves the matching
 * user IDs via a sub-query and returns an empty result immediately if none
 * exist, avoiding a full-table scan.
 *
 * @permission user:list
 * @input  page       - 1-based page number (default 1).
 * @input  search     - Optional text search matched against user name and email.
 * @input  kycStatusId - Optional KYC status ID to filter by (1–5).
 * @input  role       - Optional role name to filter by (e.g. "admin").
 * @output Paginated list of `adminUserListItemSchema` rows with role arrays.
 */
export const listAdminUsers = base
  .use(requirePermission("user:list"))
  .input(
    z.object({
      page: z.number().int().min(1).default(1),
      search: z.string().trim().optional(),
      kycStatusId: z.number().int().min(1).max(MAX_KYC_STATUS_ID).optional(),
      role: z.string().optional(),
    })
  )
  .output(
    z.object({
      items: z.array(adminUserListItemSchema),
      total: z.number(),
      page: z.number(),
      pageSize: z.number(),
    })
  )
  .handler(async ({ input }) => {
    const offset = (input.page - 1) * ADMIN_USERS_PAGE_SIZE;
    const conditions: SQL[] = [];

    if (input.search) {
      const term = `%${input.search}%`;
      conditions.push(
        or(ilike(users.name, term), ilike(users.email, term)) as SQL
      );
    }
    if (input.kycStatusId) {
      conditions.push(eq(users.kycStatusId, input.kycStatusId));
    }

    if (input.role) {
      const roleRows = await db
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(roles.name, input.role));

      const ids = roleRows.map((r) => r.userId);
      if (ids.length === 0) {
        return {
          items: [],
          total: 0,
          page: input.page,
          pageSize: ADMIN_USERS_PAGE_SIZE,
        };
      }
      conditions.push(inArray(users.id, ids));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const countQuery = db.select({ count: count() }).from(users);
    const listQuery = db
      .select({
        id: users.id,
        publicId: users.publicId,
        name: users.name,
        email: users.email,
        kycStatusId: users.kycStatusId,
        depositLimitCents: users.depositLimitCents,
        createdAt: users.createdAt,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(ADMIN_USERS_PAGE_SIZE)
      .offset(offset);

    const [[totalResult], userRows] = await Promise.all([
      where ? countQuery.where(where) : countQuery,
      where ? listQuery.where(where) : listQuery,
    ]);

    const total = totalResult?.count ?? 0;
    const rolesMap = await fetchRolesForUsers(userRows.map((u) => u.id));

    const items = userRows.map((u) => ({
      publicId: u.publicId,
      name: u.name,
      email: u.email,
      kycStatusId: u.kycStatusId,
      depositLimitCents: Number(u.depositLimitCents),
      roles: rolesMap.get(u.id.toString()) ?? [],
      createdAt: u.createdAt,
      deletedAt: u.deletedAt,
    }));

    return {
      items,
      total,
      page: input.page,
      pageSize: ADMIN_USERS_PAGE_SIZE,
    };
  });

/**
 * Returns the full profile of a single user including their role assignments.
 *
 * @permission user:read
 * @input  publicId - UUID of the user to retrieve.
 * @output Full `adminUserDetailSchema` row.
 */
export const getAdminUser = base
  .use(requirePermission("user:read"))
  .input(z.object({ publicId: z.uuid() }))
  .output(adminUserDetailSchema)
  .handler(async ({ input }) => {
    const user = await findUserByPublicId(input.publicId);
    const rolesMap = await fetchRolesForUsers([user.id]);
    const userRoleNames = rolesMap.get(user.id.toString()) ?? [];

    return {
      publicId: user.publicId,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      kycStatusId: user.kycStatusId,
      kycVerifiedAt: user.kycVerifiedAt,
      depositLimitCents: Number(user.depositLimitCents),
      roles: userRoleNames,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };
  });

/**
 * Updates the maximum single-deposit amount allowed for a user.
 *
 * The old and new limit values are recorded in the audit log for compliance.
 *
 * @permission user:write
 * @input  publicId           - UUID of the user to update.
 * @input  depositLimitCents  - New limit in cents (must be ≥ 0).
 * @output Confirmation message.
 */
export const updateUserDepositLimit = base
  .use(requirePermission("user:write"))
  .input(
    z.object({
      publicId: z.uuid(),
      depositLimitCents: z
        .number()
        .int()
        .min(0, "Deposit limit must be non-negative"),
    })
  )
  .output(z.object({ message: z.string() }))
  .handler(async ({ input, context }) => {
    const user = await findUserByPublicId(input.publicId);
    const oldLimit = Number(user.depositLimitCents);

    await db
      .update(users)
      .set({
        depositLimitCents: BigInt(input.depositLimitCents),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    const auditResult = await auditService.log({
      userId: BigInt(context.session.userId),
      action: "user.update_deposit_limit",
      entityType: "user",
      entityId: user.id,
      oldValues: { depositLimitCents: oldLimit },
      newValues: { depositLimitCents: input.depositLimitCents },
    });

    if (auditResult.isErr()) {
      throw mapToORPCError(auditResult.error);
    }

    return { message: "Deposit limit updated successfully" };
  });

/**
 * Suspends a user account by setting `deletedAt` to the current timestamp
 * and immediately invalidating all of their active sessions.
 *
 * Returns `BAD_REQUEST` when the user is already suspended to prevent
 * double-suspension from creating a misleading audit trail.
 *
 * @permission user:write
 * @input  publicId - UUID of the user to suspend.
 * @output Confirmation message.
 */
export const suspendUser = base
  .use(requirePermission("user:write"))
  .input(z.object({ publicId: z.uuid() }))
  .output(z.object({ message: z.string() }))
  .handler(async ({ input, context }) => {
    const user = await findUserByPublicId(input.publicId);

    if (user.deletedAt !== null) {
      throw new ORPCError("BAD_REQUEST", {
        message: "User is already suspended",
      });
    }

    const suspendedAt = new Date();

    await Promise.all([
      db
        .update(users)
        .set({ deletedAt: suspendedAt, updatedAt: suspendedAt })
        .where(eq(users.id, user.id)),
      db.delete(sessions).where(eq(sessions.userId, user.id)),
    ]);

    const auditResult = await auditService.log({
      userId: BigInt(context.session.userId),
      action: "user.suspend",
      entityType: "user",
      entityId: user.id,
      oldValues: { deletedAt: null },
      newValues: { deletedAt: suspendedAt.toISOString() },
    });

    if (auditResult.isErr()) {
      throw mapToORPCError(auditResult.error);
    }

    return { message: "User suspended and sessions invalidated" };
  });

/**
 * Restores a previously suspended user account by clearing `deletedAt`.
 *
 * Returns `BAD_REQUEST` when the user is not currently suspended to prevent
 * no-op writes from creating a misleading audit trail.
 *
 * @permission user:write
 * @input  publicId - UUID of the user to restore.
 * @output Confirmation message.
 */
export const restoreUser = base
  .use(requirePermission("user:write"))
  .input(z.object({ publicId: z.uuid() }))
  .output(z.object({ message: z.string() }))
  .handler(async ({ input, context }) => {
    const user = await findUserByPublicId(input.publicId);

    if (user.deletedAt === null) {
      throw new ORPCError("BAD_REQUEST", {
        message: "User is not suspended",
      });
    }

    await db
      .update(users)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    const auditResult = await auditService.log({
      userId: BigInt(context.session.userId),
      action: "user.restore",
      entityType: "user",
      entityId: user.id,
      oldValues: { deletedAt: user.deletedAt.toISOString() },
      newValues: { deletedAt: null },
    });

    if (auditResult.isErr()) {
      throw mapToORPCError(auditResult.error);
    }

    return { message: "User restored successfully" };
  });
