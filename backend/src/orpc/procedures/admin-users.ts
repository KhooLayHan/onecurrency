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
import z from "zod";
import { db } from "@/src/db";
import { UserRepository } from "@/src/repositories/user.repository";
import { AuditService } from "@/src/services/audit.service";
import { base } from "../context";
import { mapToORPCError } from "../errors";
import { requirePermission } from "../middleware";

const userRepository = new UserRepository(db);
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
 * Returns a paginated list of users, optionally filtered by name/email search,
 * KYC status, or assigned role.
 *
 * @permission user:list
 * @input  page        - 1-based page number (default 1).
 * @input  search      - Optional text search matched against user name and email.
 * @input  kycStatusId - Optional KYC status ID to filter by (1–5).
 * @input  role        - Optional role name to filter by (e.g. "admin").
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
    const result = await userRepository.listAdmin({
      page: input.page,
      pageSize: ADMIN_USERS_PAGE_SIZE,
      search: input.search,
      kycStatusId: input.kycStatusId,
      role: input.role,
    });
    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }

    return {
      items: result.value.items.map((u) => ({
        publicId: u.publicId,
        name: u.name,
        email: u.email,
        kycStatusId: u.kycStatusId,
        depositLimitCents: Number(u.depositLimitCents),
        roles: u.roles,
        createdAt: u.createdAt,
        deletedAt: u.deletedAt,
      })),
      total: result.value.total,
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
    const userResult = await userRepository.findByPublicId(input.publicId);
    if (userResult.isErr()) {
      throw mapToORPCError(userResult.error);
    }
    const user = userResult.value;
    if (!user) {
      throw new ORPCError("NOT_FOUND", { message: "User not found" });
    }

    const rolesResult = await userRepository.fetchRolesByIds([user.id]);
    if (rolesResult.isErr()) {
      throw mapToORPCError(rolesResult.error);
    }
    const roles = rolesResult.value.get(user.id.toString()) ?? [];

    return {
      publicId: user.publicId,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      kycStatusId: user.kycStatusId,
      kycVerifiedAt: user.kycVerifiedAt,
      depositLimitCents: Number(user.depositLimitCents),
      roles,
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
 * @input  publicId          - UUID of the user to update.
 * @input  depositLimitCents - New limit in cents (must be ≥ 0).
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
    const userResult = await userRepository.findByPublicId(input.publicId);
    if (userResult.isErr()) {
      throw mapToORPCError(userResult.error);
    }
    const user = userResult.value;
    if (!user) {
      throw new ORPCError("NOT_FOUND", { message: "User not found" });
    }

    const oldLimit = Number(user.depositLimitCents);

    const updateResult = await userRepository.updateDepositLimit(
      user.id,
      BigInt(input.depositLimitCents)
    );
    if (updateResult.isErr()) {
      throw mapToORPCError(updateResult.error);
    }

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
    const userResult = await userRepository.findByPublicId(input.publicId);
    if (userResult.isErr()) {
      throw mapToORPCError(userResult.error);
    }
    const user = userResult.value;
    if (!user) {
      throw new ORPCError("NOT_FOUND", { message: "User not found" });
    }

    if (user.deletedAt !== null) {
      throw new ORPCError("BAD_REQUEST", {
        message: "User is already suspended",
      });
    }

    const suspendedAt = new Date();

    const suspendResult = await userRepository.suspend(user.id, suspendedAt);
    if (suspendResult.isErr()) {
      throw mapToORPCError(suspendResult.error);
    }

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
    const userResult = await userRepository.findByPublicId(input.publicId);
    if (userResult.isErr()) {
      throw mapToORPCError(userResult.error);
    }
    const user = userResult.value;
    if (!user) {
      throw new ORPCError("NOT_FOUND", { message: "User not found" });
    }

    if (user.deletedAt === null) {
      throw new ORPCError("BAD_REQUEST", {
        message: "User is not suspended",
      });
    }

    const restoreResult = await userRepository.restore(user.id);
    if (restoreResult.isErr()) {
      throw mapToORPCError(restoreResult.error);
    }

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
