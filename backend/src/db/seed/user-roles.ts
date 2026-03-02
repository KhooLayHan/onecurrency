import { faker } from "@faker-js/faker";
import { db } from "@/src/db";
import { userRoles } from "../schema/user-roles";
import { weightedRandom } from "./helpers";
import type { UserRoleSeedConfig } from "./config";
import type { NewUserRole } from "../schema/user-roles";
import { logger } from "@/src/lib/logger";

export async function seedUserRoles(
  users: Array<{ id: bigint; email: string; createdAt: Date }>,
  config: UserRoleSeedConfig,
  specialUsers: Array<{ id: bigint; roleId: number; email: string }>
): Promise<
  Array<{
    id: bigint;
    userId: bigint;
    roleId: number;
  }>
> {
  const roleRecords: NewUserRole[] = [];

  // Find admin user to use as grantedBy for elevated roles
  const adminUser = specialUsers.find((u) => u.roleId === 2);
  const grantedByUserId = adminUser?.id;

  // Track which users already have roles (special users)
  const usersWithRoles = new Set<bigint>();
  for (const specialUser of specialUsers) {
    usersWithRoles.add(specialUser.id);

    // Special users are already assigned roles in special-users.ts
    // We don't need to insert them again, but we add them to the set to skip
  }

  // Filter out special users from regular role assignment
  const regularUsers = users.filter((user) => !usersWithRoles.has(user.id));

  // Prepare weighted role options
  const roleOptions = Object.entries(config.roleDistribution).map(
    ([roleId, weight]) => ({
      value: Number.parseInt(roleId, 10),
      weight,
    })
  );

  for (const user of regularUsers) {
    // Every user gets at least the 'user' role (ID: 1)
    const primaryRoleId = 1;

    roleRecords.push({
      userId: user.id,
      roleId: primaryRoleId,
      grantedByUserId,
      grantedAt: faker.date.between({ from: user.createdAt, to: new Date() }),
    });

    // Some users get additional elevated roles based on distribution
    const additionalRoleRoll = faker.number.int({ min: 1, max: 100 });
    const hasAdditionalRole = additionalRoleRoll > 95; // 5% chance for elevated roles

    if (hasAdditionalRole) {
      const elevatedRole = weightedRandom(
        roleOptions.filter((r) => r.value !== 1) // Exclude 'user' role
      );

      if (elevatedRole && elevatedRole !== 1) {
        roleRecords.push({
          userId: user.id,
          roleId: elevatedRole,
          grantedByUserId,
          grantedAt: faker.date.between({
            from: user.createdAt,
            to: new Date(),
          }),
        });
      }
    }
  }

  // Add special user roles (they weren't inserted yet)
  for (const specialUser of specialUsers) {
    roleRecords.push({
      userId: specialUser.id,
      roleId: specialUser.roleId,
      grantedByUserId:
        specialUser.roleId === 2 ? specialUser.id : grantedByUserId,
      grantedAt: faker.date.past({ years: 0.5 }),
    });
  }

  if (roleRecords.length === 0) {
    return [];
  }

  // Insert in batches
  const createdRoles: Array<{
    id: bigint;
    userId: bigint;
    roleId: number;
  }> = [];

  for (let i = 0; i < roleRecords.length; i += 50) {
    const batch = roleRecords.slice(i, i + 50);

    try {
      const result = await db.insert(userRoles).values(batch).returning({
        id: userRoles.id,
        userId: userRoles.userId,
        roleId: userRoles.roleId,
      });

      createdRoles.push(...result);
    } catch (error) {
      // Handle unique constraint violations gracefully
      // (e.g., if a user already has the role assigned)
      logger.warn(
        `Some role assignments skipped (possible duplicates): ${error}`
      );
    }
  }

  logger.info(`Created ${createdRoles.length} user role assignments`);
  return createdRoles;
}
