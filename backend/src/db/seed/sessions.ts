import { faker } from "@faker-js/faker";
import { db } from "@/src/db";
import { logger } from "@/src/lib/logger";
import type { NewSession } from "../schema/sessions";
import { sessions } from "../schema/sessions";
import type { SessionSeedConfig } from "./config";
import { generateUserAgent, randomBetween } from "./helpers";

export async function seedSessions(
  users: Array<{ id: bigint; createdAt: Date }>,
  config: SessionSeedConfig
): Promise<
  Array<{
    id: bigint;
    userId: bigint;
    token: string;
    expiresAt: Date;
  }>
> {
  const sessionRecords: NewSession[] = [];

  for (const user of users) {
    const sessionCount = randomBetween(config.perUser.min, config.perUser.max);

    for (let i = 0; i < sessionCount; i++) {
      const createdAt = faker.date.between({
        from: user.createdAt,
        to: new Date(),
      });

      // 40% active, 60% expired
      const isActive = faker.datatype.boolean(0.4);
      const expiresAt = isActive
        ? faker.date.future({ years: 0.1, refDate: new Date() }) // ~1 month
        : faker.date.between({ from: createdAt, to: new Date() });

      sessionRecords.push({
        userId: user.id,
        token: faker.string.uuid(),
        expiresAt,
        ipAddress: faker.internet.ip(),
        userAgent: generateUserAgent(),
        createdAt,
        updatedAt: faker.date.between({ from: createdAt, to: new Date() }),
      });
    }
  }

  // Insert in batches
  const createdSessions: Array<{
    id: bigint;
    userId: bigint;
    token: string;
    expiresAt: Date;
  }> = [];

  for (let i = 0; i < sessionRecords.length; i += 50) {
    const batch = sessionRecords.slice(i, i + 50);

    const result = await db.insert(sessions).values(batch).returning({
      id: sessions.id,
      userId: sessions.userId,
      token: sessions.token,
      expiresAt: sessions.expiresAt,
    });

    createdSessions.push(...result);
  }

  logger.info(`Created ${createdSessions.length} sessions`);
  return createdSessions;
}
