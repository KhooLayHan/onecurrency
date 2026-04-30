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

const ADMIN_USERS_PAGE_SIZE = 20;
const MAX_KYC_STATUS_ID = 5;

// ─── Shared output schemas ──────────────────────────────────────────────────

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

// ─── Helper: batch-fetch roles for a list of user IDs ──────────────────────

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

// ─── Helper: find user by publicId or throw NOT_FOUND ───────────────────

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

// ─── listAdminUsers ────────────────────────────────────────────────────────

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

// ─── getAdminUser ───────────────────────────────────────────────────────────

export const getAdminUser = base
  .use(requirePermission("user:read"))
  .input(z.object({ publicId: z.uuid() }))
  .output(adminUserDetailSchema)
  .handler(async ({ input }) => {
    const user = await findUserByPublicId(input.publicId);
    const userRoleRows = await db
      .select({ roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id));

    return {
      publicId: user.publicId,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      kycStatusId: user.kycStatusId,
      kycVerifiedAt: user.kycVerifiedAt,
      depositLimitCents: Number(user.depositLimitCents),
      roles: userRoleRows.map((r) => r.roleName),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };
  });

// ─── updateUserDepositLimit ────────────────────────────────────────────────

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

// ─── suspendUser ────────────────────────────────────────────────────────────

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

// ─── restoreUser ────────────────────────────────────────────────────────────

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
