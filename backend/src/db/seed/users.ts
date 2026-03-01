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
  const kycDistribution = distributeByPercentage(
    regularUserCount,
    config.kycDistribution,
  );

  const userRecords: NewUser[] = [];
  const userKycMap = new Map<number, number>();

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

      userKycMap.set(userRecords.length - 1, kycStatusId);
    }
  }

  // Shuffle users to mix KYC statuses
  for (let i = userRecords.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    if (userRecords[i] !== undefined) {
      const temp = userRecords[i];
      // userRecords[i] = userRecords[j];
      // userRecords[j] = temp;
    }

    //[userRecords[i], userRecords[j]] = [userRecords[j], userRecords[i]];
    //     const temp: {
    //     name: string;
    //     email: string;
    //     createdAt?: Date | undefined;
    //     publicId?: string | undefined;
    //     emailVerified?: boolean | undefined;
    //     image?: string | null | undefined;
    //     updatedAt?: Date | undefined;
    //     kycStatusId?: number | undefined;
    //     kycVerifiedAt?: Date | null | undefined;
    //     depositLimitCents?: bigint | undefined;
    //     deletedAt?: Date | null | undefined;
    // } | undefined

    const tempKyc = userKycMap.get(i);
    userKycMap.set(i, userKycMap.get(j)!);
    userKycMap.set(j, tempKyc!);
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
