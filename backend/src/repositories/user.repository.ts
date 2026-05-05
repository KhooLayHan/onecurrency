import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  type SQL,
} from "drizzle-orm";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { InternalError } from "@/common/errors/infrastructure";
import { UserNotFoundError } from "@/common/errors/user";
import type { KycStatusId } from "../constants/kyc-status";
import type { Database } from "../db";
import { roles } from "../db/schema/roles";
import { sessions } from "../db/schema/sessions";
import { userRoles } from "../db/schema/user-roles";
import { type User, users } from "../db/schema/users";

/**
 * Filter options for the admin user list query.
 */
export type AdminUserListFilters = {
  page: number;
  pageSize: number;
  search?: string;
  kycStatusId?: number;
  /** Role name to filter by (e.g. `"admin"`). Triggers a sub-query. */
  role?: string;
};

/**
 * A single row returned by the admin user list query.
 * `depositLimitCents` is a raw `bigint` — callers convert to `number` for
 * API serialisation.
 */
export type AdminUserListItem = {
  id: bigint;
  publicId: string;
  name: string;
  email: string;
  kycStatusId: number;
  depositLimitCents: bigint;
  createdAt: Date;
  deletedAt: Date | null;
  roles: string[];
};

export class UserRepository {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  // ─── User-facing methods ────────────────────────────────────────────────

  findById(id: bigint): ResultAsync<User | null, InternalError> {
    return ResultAsync.fromPromise(
      this.db._query.users
        .findFirst({ where: eq(users.id, id) })
        .then((user) => user ?? null),
      (e): InternalError =>
        new InternalError("Failed to fetch user from database", {
          cause: e,
          context: { userId: id.toString() },
        })
    ).map((user) => user ?? null);
  }

  findByEmail(email: string): ResultAsync<User | null, InternalError> {
    return ResultAsync.fromPromise(
      this.db._query.users
        .findFirst({
          where: and(eq(users.email, email), isNull(users.deletedAt)),
        })
        .then((user) => user ?? null),
      (e): InternalError =>
        new InternalError("Failed to fetch user by email", {
          cause: e,
          context: { email },
        })
    ).map((user) => user ?? null);
  }

  updateKycStatus(
    id: bigint,
    statusId: KycStatusId
  ): ResultAsync<void, UserNotFoundError | InternalError> {
    return ResultAsync.fromPromise(
      this.db
        .update(users)
        .set({
          kycStatusId: statusId,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning({ id: users.id }),
      (e): InternalError =>
        new InternalError("Failed to update user KYC status", {
          cause: e,
          context: { userId: id.toString(), statusId },
        })
    ).andThen((rows) => {
      if (rows.length === 0) {
        return errAsync(new UserNotFoundError(id.toString()));
      }
      return okAsync(undefined);
    });
  }

  updateStripeConnectAccountId(
    id: bigint,
    stripeConnectAccountId: string
  ): ResultAsync<void, InternalError> {
    return ResultAsync.fromPromise(
      this.db
        .update(users)
        .set({ stripeConnectAccountId, updatedAt: new Date() })
        .where(eq(users.id, id)),
      (e): InternalError =>
        new InternalError("Failed to save Stripe Connect account ID", {
          cause: e,
          context: { userId: id.toString() },
        })
    ).andThen(() => okAsync(undefined));
  }

  // ─── Admin methods ──────────────────────────────────────────────────────

  /**
   * Finds a single user by their public UUID.
   *
   * Returns `null` when no user matches. The caller is responsible for
   * throwing a `NOT_FOUND` error when a match is required.
   *
   * @param publicId - The user's UUID public identifier.
   * @returns The matching user row, or `null`.
   */
  findByPublicId(publicId: string): ResultAsync<User | null, InternalError> {
    return ResultAsync.fromPromise(
      this.db._query.users
        .findFirst({ where: eq(users.publicId, publicId) })
        .then((user) => user ?? null),
      (e): InternalError =>
        new InternalError("Failed to fetch user by public ID", {
          cause: e,
          context: { publicId },
        })
    );
  }

  /**
   * Returns a paginated, filterable list of users for the admin UI.
   *
   * When a `role` filter is supplied, a sub-query first resolves the
   * matching user IDs; if none exist the method short-circuits and returns
   * an empty result, avoiding a full-table scan.
   *
   * Role names are batch-fetched for the result page and merged into each
   * item — callers receive fully enriched rows.
   *
   * @param filters - Pagination parameters and optional filter criteria.
   * @returns Paginated `AdminUserListItem` rows with `roles` arrays, and total count.
   */
  listAdmin(
    filters: AdminUserListFilters
  ): ResultAsync<{ items: AdminUserListItem[]; total: number }, InternalError> {
    return ResultAsync.fromPromise(
      (async () => {
        const whereResult = await this._buildAdminWhere(filters);
        if (whereResult.emptyResult) {
          return { items: [], total: 0 };
        }

        const offset = (filters.page - 1) * filters.pageSize;
        const countQuery = this.db.select({ count: count() }).from(users);
        const listQuery = this.db
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
          .limit(filters.pageSize)
          .offset(offset);

        const [[totalResult], userRows] = await Promise.all([
          whereResult.where ? countQuery.where(whereResult.where) : countQuery,
          whereResult.where ? listQuery.where(whereResult.where) : listQuery,
        ]);

        const total = totalResult?.count ?? 0;
        const rolesMap = await this._fetchRolesMapRaw(
          userRows.map((u) => u.id)
        );

        const items: AdminUserListItem[] = userRows.map((u) => ({
          id: u.id,
          publicId: u.publicId,
          name: u.name,
          email: u.email,
          kycStatusId: u.kycStatusId,
          depositLimitCents: u.depositLimitCents ?? 0n,
          createdAt: u.createdAt,
          deletedAt: u.deletedAt,
          roles: rolesMap.get(u.id.toString()) ?? [],
        }));

        return { items, total };
      })(),
      (e): InternalError =>
        new InternalError("Failed to list admin users", { cause: e })
    );
  }

  /**
   * Batch-fetches role names for a list of user IDs.
   *
   * Returns a `Map<userId, roleNames[]>` keyed by stringified user ID.
   * An empty map is returned immediately when `userIds` is empty to avoid
   * an unnecessary DB round-trip.
   *
   * @param userIds - Array of bigint user primary keys to fetch roles for.
   * @returns Map from user ID string to the list of role names.
   */
  fetchRolesByIds(
    userIds: bigint[]
  ): ResultAsync<Map<string, string[]>, InternalError> {
    return ResultAsync.fromPromise(
      this._fetchRolesMapRaw(userIds),
      (e): InternalError =>
        new InternalError("Failed to fetch roles for users", { cause: e })
    );
  }

  /**
   * Updates the maximum single-deposit amount for a user.
   *
   * @param id         - The user's primary key.
   * @param limitCents - New limit in cents as `bigint`.
   */
  updateDepositLimit(
    id: bigint,
    limitCents: bigint
  ): ResultAsync<void, InternalError> {
    return ResultAsync.fromPromise(
      this.db
        .update(users)
        .set({ depositLimitCents: limitCents, updatedAt: new Date() })
        .where(eq(users.id, id)),
      (e): InternalError =>
        new InternalError("Failed to update user deposit limit", {
          cause: e,
          context: { userId: id.toString() },
        })
    ).andThen(() => okAsync(undefined));
  }

  /**
   * Suspends a user by setting `deletedAt` to `suspendedAt` and deleting
   * all of their active sessions in a single parallel operation.
   *
   * @param id          - The user's primary key.
   * @param suspendedAt - Timestamp to record as the suspension time.
   */
  suspend(id: bigint, suspendedAt: Date): ResultAsync<void, InternalError> {
    return ResultAsync.fromPromise(
      Promise.all([
        this.db
          .update(users)
          .set({ deletedAt: suspendedAt, updatedAt: suspendedAt })
          .where(eq(users.id, id)),
        this.db.delete(sessions).where(eq(sessions.userId, id)),
      ]),
      (e): InternalError =>
        new InternalError("Failed to suspend user", {
          cause: e,
          context: { userId: id.toString() },
        })
    ).andThen(() => okAsync(undefined));
  }

  /**
   * Restores a previously suspended user by clearing `deletedAt`.
   *
   * @param id - The user's primary key.
   */
  restore(id: bigint): ResultAsync<void, InternalError> {
    return ResultAsync.fromPromise(
      this.db
        .update(users)
        .set({ deletedAt: null, updatedAt: new Date() })
        .where(eq(users.id, id)),
      (e): InternalError =>
        new InternalError("Failed to restore user", {
          cause: e,
          context: { userId: id.toString() },
        })
    ).andThen(() => okAsync(undefined));
  }

  /**
   * Builds the Drizzle `where` clause for the admin user list query.
   *
   * When a `role` filter is supplied, a sub-query first resolves the matching
   * user IDs. If none exist, `emptyResult` is set to `true` so the caller
   * can short-circuit without running the main count/data queries.
   *
   * @param filters - Admin user list filter criteria.
   * @returns The where clause (or `undefined` if no filters), and an `emptyResult`
   *          flag that signals an immediate empty response is required.
   */
  private async _buildAdminWhere(
    filters: AdminUserListFilters
  ): Promise<{ where?: SQL; emptyResult: boolean }> {
    const conditions: SQL[] = [];

    if (filters.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(ilike(users.name, term), ilike(users.email, term)) as SQL
      );
    }
    if (filters.kycStatusId) {
      conditions.push(eq(users.kycStatusId, filters.kycStatusId));
    }
    if (filters.role) {
      const roleRows = await this.db
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(roles.name, filters.role));

      const ids = roleRows.map((r) => r.userId);
      if (ids.length === 0) {
        return { emptyResult: true };
      }
      conditions.push(inArray(users.id, ids));
    }

    return {
      where: conditions.length > 0 ? and(...conditions) : undefined,
      emptyResult: false,
    };
  }

  /**
   * Internal raw async implementation of the role batch-fetch used by both
   * `listAdmin` (inside the async IIFE) and `fetchRolesByIds` (public API).
   */
  private async _fetchRolesMapRaw(
    userIds: bigint[]
  ): Promise<Map<string, string[]>> {
    if (userIds.length === 0) {
      return new Map();
    }
    const rows = await this.db
      .select({ userId: userRoles.userId, roleName: roles.name })
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
}
