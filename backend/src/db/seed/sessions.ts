import { faker } from "@faker-js/faker";
import { logger } from "@/src/lib/logger";
import { sessions } from "../schema/sessions";
import { defaultSeedConfig } from "./config";
import { batchInsert, generateUserAgent, randomBetween } from "./helpers";

const SESSION_EXPIRY_MIN_DAYS = 7;
const SESSION_EXPIRY_MAX_DAYS = 30;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MS_PER_DAY =
  MS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY;

export async function seedSessions(
  users: Array<{ id: bigint; createdAt: Date }>
): Promise<void> {
  const { min, max } = defaultSeedConfig.sessions.perUser;
  const records: {
    userId: bigint;
    token: string;
    expiresAt: Date;
    ipAddress: string;
    userAgent: string;
    createdAt: Date;
    updatedAt: Date;
  }[] = [];

  for (const user of users) {
    const count = randomBetween(min, max);
    for (let i = 0; i < count; i++) {
      const createdAt = faker.date.between({
        from: user.createdAt,
        to: new Date(),
      });
      const daysUntilExpiry = randomBetween(
        SESSION_EXPIRY_MIN_DAYS,
        SESSION_EXPIRY_MAX_DAYS
      );
      // Anchor expiry to session creation time, not wall-clock now
      const expiresAt = new Date(
        createdAt.getTime() + daysUntilExpiry * MS_PER_DAY
      );

      records.push({
        userId: user.id,
        token: faker.string.uuid(),
        expiresAt,
        ipAddress: faker.internet.ipv4(),
        userAgent: generateUserAgent(),
        createdAt,
        updatedAt: faker.date.between({ from: createdAt, to: new Date() }),
      });
    }
  }

  await batchInsert(sessions, records, { batchSize: 50 });
  logger.info(`Created ${records.length} sessions for ${users.length} users`);
}
