import { logger } from "@/src/lib/logger";
import { userRoles } from "../schema/user-roles";
import { batchInsert } from "./helpers";
import { getRoleIds } from "./lookup";
import type { SeededRegularUser } from "./types";

export async function seedRegularUserRoles(
  regularUsers: SeededRegularUser[],
  grantedByUserId: bigint
): Promise<void> {
  const roleIds = await getRoleIds();
  const userRoleId = roleIds.user;

  const records = regularUsers.map((user) => ({
    userId: user.id,
    roleId: userRoleId,
    grantedByUserId,
  }));

  await batchInsert(userRoles, records, { batchSize: 50 });
  logger.info(`Assigned user role to ${records.length} regular users`);
}
