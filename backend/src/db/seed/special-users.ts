import { faker } from "@faker-js/faker";
import { db } from "@/src/db";
import { accounts } from "../schema/accounts";
import { users } from "../schema/users";
import type { SpecialUserConfig } from "./config";
import { logger } from "@/src/lib/logger";
import { drizzle } from "drizzle-orm/neon-serverless";

import { relations } from "../schema/relations";
import { eq } from "drizzle-orm";


async function hashPassword(password: string): Promise<string> {  
  try {
    return Bun.password.hash(password, {
      algorithm: "argon2id",     
    });
  } catch {
    logger.error("Password hashing failed - Bun.password.hash is required for seeding");
    throw new Error("Password hashing not available");
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

    // const existingUser = await db.select().from(users).where(eq(users.email, userConfig.email)).limit(1).then(r => r[0]);

    const existingUser = await db._query.users.findFirst({    
      where: (users, { eq }) => eq(users.email, userConfig.email),
    });

    if (existingUser) {
      logger.info(
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
    logger.info(`Created special user: ${userConfig.email} (ID: ${user.id})`);
  }

  return createdUsers;
}
