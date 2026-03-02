import { faker } from "@faker-js/faker";
import { db } from "@/src/db";
import { accounts } from "../schema/accounts";
import type { NewAccount } from "../schema/accounts";
import { logger } from "@/src/lib/logger";

export async function seedAccounts(
  users: Array<{ id: bigint; email: string; name: string; createdAt: Date }>,
  oauthPercentage: number = 30
): Promise<
  Array<{
    id: bigint;
    userId: bigint;
    providerId: string;
    accountId: string;
  }>
> {
  const accountRecords: NewAccount[] = [];

  // Select 30% of users to have OAuth accounts
  const shuffledUsers = faker.helpers.shuffle([...users]);
  const oauthUserCount = Math.floor(users.length * (oauthPercentage / 100));
  const oauthUsers = shuffledUsers.slice(0, oauthUserCount);

  const providers = [
    { id: "google", weight: 70 },
    { id: "github", weight: 30 },
  ];

  for (const user of oauthUsers) {
    // Select provider based on weights
    const providerRoll = faker.number.int({ min: 1, max: 100 });
    const providerId = providerRoll <= 70 ? "google" : "github";

    const createdAt = faker.date.between({
      from: user.createdAt,
      to: new Date(),
    });

    // Generate OAuth-specific data
    let accountId: string;
    let scope: string;

    if (providerId === "google") {
      // Google account ID (numeric)
      accountId = faker.number
        .bigInt({ min: 100000000000000000000n, max: 999999999999999999999n })
        .toString();
      scope = "openid email profile";
    } else {
      // GitHub account ID (numeric)
      accountId = faker.number
        .int({ min: 10000000, max: 999999999 })
        .toString();
      scope = "read:user user:email";
    }

    accountRecords.push({
      userId: user.id,
      accountId,
      providerId,
      accessToken: faker.string.alphanumeric(128),
      refreshToken: faker.datatype.boolean(0.8)
        ? faker.string.alphanumeric(128)
        : undefined,
      accessTokenExpiresAt: faker.date.future({
        years: 0.1,
        refDate: createdAt,
      }),
      refreshTokenExpiresAt: faker.datatype.boolean(0.7)
        ? faker.date.future({ years: 0.5, refDate: createdAt })
        : undefined,
      scope,
      idToken:
        providerId === "google"
          ? faker.string.alphanumeric(256) +
            "." +
            faker.string.alphanumeric(256)
          : undefined,
      createdAt,
      updatedAt: faker.date.between({ from: createdAt, to: new Date() }),
    });
  }

  if (accountRecords.length === 0) {
    return [];
  }

  // Insert in batches
  const createdAccounts: Array<{
    id: bigint;
    userId: bigint;
    providerId: string;
    accountId: string;
  }> = [];

  for (let i = 0; i < accountRecords.length; i += 50) {
    const batch = accountRecords.slice(i, i + 50);

    const result = await db.insert(accounts).values(batch).returning({
      id: accounts.id,
      userId: accounts.userId,
      providerId: accounts.providerId,
      accountId: accounts.accountId,
    });

    createdAccounts.push(...result);
  }

  logger.info(`Created ${createdAccounts.length} OAuth accounts`);
  return createdAccounts;
}
