import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users, type NewUser } from "../schema/users";
import { accounts } from "../schema/accounts";
import { logger } from "@/src/lib/logger";
import { defaultSeedConfig } from "./config";
import { batchInsertReturning } from "./helpers";
import type {
  KycStatusIds,
  SeededSpecialUser,
  SeededRegularUser,
} from "./types";
import { userRoles } from "../schema/user-roles";

import { password } from "bun";

// Query KYC status IDs from database
async function getKycStatusIds(): Promise<KycStatusIds> {
  const statuses = await db._query.kycStatuses.findMany();

  const getId = (name: string): number => {
    const status = statuses.find((s) => s.name === name);
    if (!status) {
      throw new Error(`KYC status not found: ${name}`);
    }
    return status.id;
  };

  return {
    none: getId("None"),
    pending: getId("Pending"),
    verified: getId("Verified"),
    rejected: getId("Rejected"),
    expired: getId("Expired"),
  };
}

// Seed special users with their credential accounts
export async function seedSpecialUsers(): Promise<SeededSpecialUser[]> {
  const ids = await getKycStatusIds();
  const created: SeededSpecialUser[] = [];

  for (const config of defaultSeedConfig.users.specialUsers) {
    // Check if exists
    const existing = await db._query.users.findFirst({
      where: eq(users.email, config.email),
    });

    if (existing) {
      logger.info(`Special user ${config.email} already exists`);
      created.push({
        id: existing.id,
        email: existing.email,
        name: existing.name,
        roleId: config.roleId,
      });
      continue;
    }

    const passwordHash = await password.hash(config.password, {
      algorithm: "argon2id",
    });

    const createdAt = faker.date.past({ years: 0.5 });

    // Insert user + credential account in transaction
    const [user] = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(users)
        .values({
          name: config.name,
          email: config.email,
          emailVerified: config.emailVerified,
          kycStatusId: config.kycStatusId,
          kycVerifiedAt:
            config.kycStatusId === ids.verified ? createdAt : undefined,
          depositLimitCents: config.depositLimitCents,
          createdAt,
          updatedAt: new Date(),
        })
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
        });

      if (inserted) {
        await tx.insert(accounts).values({
          userId: inserted.id,
          accountId: config.email,
          providerId: "credential",
          password: passwordHash,
          createdAt,
          updatedAt: new Date(),
        });

        await tx.insert(userRoles).values({
          userId: inserted.id,
          roleId: 2,
        });
      }

      return [inserted];
    });

    if (user) {
      created.push({
        id: user.id,
        email: user.email,
        name: user.name,
        roleId: config.roleId,
      });
    }

    logger.info(`Created special user: ${config.email}`);
  }

  return created;
}

// Seed regular fake users (no accounts needed for now)
export async function seedRegularUsers(): Promise<SeededRegularUser[]> {
  const ids = await getKycStatusIds();

  // Build distribution: 30 None, 20 Pending, 40 Verified, 8 Rejected, 2 Expired
  const kycDistributionRange = {
    none: 30,
    pending: 20,
    verified: 40,
    rejected: 8,
    expired: 2,
  } as const;

  const kycDistribution = [
    ...new Array(kycDistributionRange.none).fill(ids.none),
    ...new Array(kycDistributionRange.pending).fill(ids.pending),
    ...new Array(kycDistributionRange.verified).fill(ids.verified),
    ...new Array(kycDistributionRange.rejected).fill(ids.rejected),
    ...new Array(kycDistributionRange.expired).fill(ids.expired),
  ];

  const shuffled = faker.helpers.shuffle(kycDistribution);
  const userRecords: NewUser[] = [];

  for (const [index, kycStatusId] of shuffled.entries()) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const createdAt = faker.date.past({ years: 0.5 });
    const username = faker.internet
      .username({ firstName, lastName })
      .toLowerCase();

    let depositLimit: bigint;
    if (kycStatusId === ids.verified) {
      depositLimit = BigInt(faker.number.int({ min: 10_000, max: 1_000_000 }));
    } else if (kycStatusId === ids.pending) {
      depositLimit = BigInt(faker.number.int({ min: 5000, max: 100_000 }));
    } else {
      depositLimit = BigInt(faker.number.int({ min: 1000, max: 50_000 }));
    }

    const EMAIL_VERIFIED_PERCENTAGE = 0.7;

    userRecords.push({
      name: `${firstName} ${lastName}`,
      email: `${username}+seed${index}@example.test`,
      emailVerified: faker.datatype.boolean(EMAIL_VERIFIED_PERCENTAGE),
      kycStatusId,
      kycVerifiedAt:
        kycStatusId === ids.verified
          ? faker.date.between({ from: createdAt, to: new Date() })
          : undefined,
      depositLimitCents: depositLimit,
      createdAt,
      updatedAt: faker.date.between({ from: createdAt, to: new Date() }),
    });
  }

  // Use batchInsertReturning
  const created = await batchInsertReturning(users, userRecords, {
    returning: {
      id: users.id,
      email: users.email,
      name: users.name,
      kycStatusId: users.kycStatusId,
    },
  });

  logger.info(`Created ${created.length} regular users`);
  return created as SeededRegularUser[];
}
