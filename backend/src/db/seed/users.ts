import { faker } from "@faker-js/faker";
import { db } from "@/src/db";
import type { NewUser } from "../schema/users";
import { users } from "../schema/users";
import type { UserSeedConfig } from "./config";
import {
  distributeByPercentage,
  generateUserAgent,
  randomBetween,
} from "./helpers";
import { batchInsert } from "./types";

export async function seedRegularUsers(
  config: UserSeedConfig,
  specialUserCount: number,
): Promise<
  Array<{
    id: bigint;
    email: string;
    name: string;
    kycStatusId: number;
    createdAt: Date;
  }>
> {
  const regularUserCount = config.count - specialUserCount;
  if (regularUserCount < 0) {
    throw new Error("specialUserCount cannot exceed config.count");
  }

  const kycDistribution = distributeByPercentage(
    regularUserCount,
    config.kycDistribution,
  );

  const userRecords: NewUser[] = [];

  for (const [kycStatusId, count] of kycDistribution) {
    for (let i = 0; i < count; i++) {
      const createdAt = faker.date.past({ years: config.dateRangeMonths / 12 });
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const name = `${firstName} ${lastName}`;
      const email = faker.internet
        .email({
          firstName,
          lastName,
          provider: "gmail.com",
        })
        .toLowerCase();

      // Calculate deposit limit based on KYC status
      let depositLimitCents: bigint;
      switch (kycStatusId) {
        case 1: // None
        case 4: // Rejected
        case 5: // Expired
          depositLimitCents = BigInt(
            faker.number.int({ min: 1000, max: 50000 }),
          );
          break;
        case 2: // Pending
          depositLimitCents = BigInt(
            faker.number.int({ min: 5000, max: 100000 }),
          );
          break;
        case 3: // Verified
          depositLimitCents = BigInt(
            faker.number.int({ min: 10000, max: 1000000 }),
          );
          break;
        default:
          depositLimitCents = 10000n;
      }

      const kycVerifiedAt =
        kycStatusId === 3
          ? faker.date.between({ from: createdAt, to: new Date() })
          : undefined;

      userRecords.push({
        name,
        email,
        emailVerified: faker.datatype.boolean(0.7), // 70% verified
        image: faker.datatype.boolean(0.3) ? faker.image.avatar() : undefined,
        createdAt,
        updatedAt: faker.date.between({ from: createdAt, to: new Date() }),
        kycStatusId,
        kycVerifiedAt,
        depositLimitCents,
      });
    }
  }

  // Shuffle users to mix KYC statuses
  for (let i = userRecords.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    const current = userRecords[i];
    const target = userRecords[j];

    if (current === undefined || target === undefined) {
      continue;
    }

    userRecords[i] = target;
    userRecords[j] = current;
  }

  // Insert in batches
  const createdUsers: Array<{
    id: bigint;
    email: string;
    name: string;
    kycStatusId: number;
    createdAt: Date;
  }> = [];

  for (let i = 0; i < userRecords.length; i += 50) {
    const batch = userRecords.slice(i, i + 50);
    const result = await db.insert(users).values(batch).returning({
      id: users.id,
      email: users.email,
      name: users.name,
      kycStatusId: users.kycStatusId,
      createdAt: users.createdAt,
    });

    createdUsers.push(...result);
  }

  console.log(`Created ${createdUsers.length} regular users`);
  return createdUsers;
}
