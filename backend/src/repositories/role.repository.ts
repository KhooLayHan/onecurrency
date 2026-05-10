import { eq } from "drizzle-orm";
import { okAsync, ResultAsync } from "neverthrow";
import { InternalError } from "@/common/errors/infrastructure";
import type { Database } from "../db";
import { roles } from "../db/schema/roles";
import { userRoles } from "../db/schema/user-roles";

export class RoleRepository {
  private readonly db: Database;
  constructor(database: Database) {
    this.db = database;
  }
  assignDefaultUserRole(userId: bigint): ResultAsync<void, InternalError> {
    return ResultAsync.fromPromise(
      (async () => {
        const [role] = await this.db
          .select({ id: roles.id })
          .from(roles)
          .where(eq(roles.name, "user"))
          .limit(1);
        if (!role) {
          throw new Error('"user" role not found in database');
        }
        await this.db
          .insert(userRoles)
          .values({ userId, roleId: role.id })
          .onConflictDoNothing();
      })(),
      (e): InternalError =>
        new InternalError("Failed to assign default user role", {
          cause: e,
          context: { userId: userId.toString() },
        })
    ).andThen(() => okAsync(undefined));
  }
}
