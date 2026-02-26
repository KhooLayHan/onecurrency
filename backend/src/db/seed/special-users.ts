import { faker } from "@faker-js/faker";
import { db } from "@/src/db";
import { accounts } from "../schema/accounts";
import { users } from "../schema/users";
import type { SpecialUserConfig } from "./config";

async function hashPassword(password: string): Promise<string> {
  // TODO: Replace with Better-Auth's hashPassword when Better-Auth is installed
  // For now, using a simple bcrypt hash (requires bcrypt package)
  // Install with: bun add bcrypt
  // For development seeding, you can also use: return password;
  try {
    const bcrypt = await import("bcrypt");
    return bcrypt.hash(password, 10);
  } catch {
    // If bcrypt is not available, return a placeholder hash
    // In production, always use proper hashing
    console.warn("bcrypt not available, using placeholder hash for seeding");
    return `$2b$10$${faker.string.alphanumeric(53)}`;
  }
}

async function createSpecialUser(config: SpecialUserConfig): Promise<{
  id: bigint;
  email: string;
  name: string;
  roleId: number;
  kycStatusId: number;
}> {
  const passwordHash = await hashPassword(config.password);
  const now = new Date();
  const createdAt = faker.date.past({ years: 0.5 });

  const userResult = await db
    .insert(users)
    .values({
      name: config.name,
      email: config.email,
      emailVerified: config.emailVerified,
      kycStatusId: config.kycStatusId,
      depositLimitCents: config.depositLimitCents,
      createdAt,
      updatedAt: now,
    })
    .returning({ id: users.id });

  const userId = userResult[0]?.id;
  if (!userId) {
    throw new Error(`Failed to create special user: ${config.email}`);
  }

  // Create credential account for Better-Auth
  await db.insert(accounts).values({
    userId,
    accountId: config.email,
    providerId: "credential",
    password: passwordHash,
    createdAt,
    updatedAt: now,
  });

  return {
    id: userId,
    email: config.email,
    name: config.name,
    roleId: config.roleId,
    kycStatusId: config.kycStatusId,
  };
}

export async function seedSpecialUsers(
  specialUsers: SpecialUserConfig[]
): Promise<
  Array<{
    id: bigint;
    email: string;
    name: string;
    roleId: number;
    kycStatusId: number;
  }>
> {
  const createdUsers = [];

  for (const userConfig of specialUsers) {
    const existingUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, userConfig.email),
    });

    if (existingUser) {
      console.log(
        `Special user ${userConfig.email} already exists, skipping...`
      );
      createdUsers.push({
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
        roleId: userConfig.roleId,
        kycStatusId: existingUser.kycStatusId,
      });
      continue;
    }

    const user = await createSpecialUser(userConfig);
    createdUsers.push(user);
    console.log(`Created special user: ${userConfig.email} (ID: ${user.id})`);
  }

  return createdUsers;
}
