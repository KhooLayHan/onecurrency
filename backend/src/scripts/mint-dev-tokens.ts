/**
 * Dev-only script: mints ONE tokens to all active custodial primary wallets.
 * Safe to re-run — just adds more tokens.
 *
 * Usage:
 *   bun run src/scripts/mint-dev-tokens.ts
 *   bun run src/scripts/mint-dev-tokens.ts --amount=500
 */
import { and, eq, isNull } from "drizzle-orm";
import { db, pool } from "../db";
import { users } from "../db/schema/users";
import { wallets } from "../db/schema/wallets";
import { logger } from "../lib/logger";
import { mintTokens } from "../services/blockchain";

const DEFAULT_MINT_AMOUNT_USD = 1000;
const TOKEN_DECIMALS = 18;
const BASE = 10n;
const WEI_PER_DOLLAR = BASE ** BigInt(TOKEN_DECIMALS);

function parseAmountArg(argv: string[]): number {
  const arg = argv.find((a) => a.startsWith("--amount="));
  if (!arg) {
    return DEFAULT_MINT_AMOUNT_USD;
  }
  const parsed = Number.parseInt(arg.replace("--amount=", ""), 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid --amount value: ${arg}`);
  }
  return parsed;
}

function usdToWei(amountUsd: number): string {
  return (BigInt(amountUsd) * WEI_PER_DOLLAR).toString();
}

async function run() {
  const amountUsd = parseAmountArg(process.argv);
  const amountWei = usdToWei(amountUsd);

  logger.info(
    { amountUsd, amountWei },
    "Scanning for custodial primary wallets to mint..."
  );

  const targets = await db
    .select({
      address: wallets.address,
      email: users.email,
      userId: wallets.userId,
    })
    .from(wallets)
    .innerJoin(users, eq(wallets.userId, users.id))
    .where(
      and(
        eq(wallets.walletType, "CUSTODIAL"),
        eq(wallets.isPrimary, true),
        isNull(wallets.deletedAt),
        isNull(users.deletedAt)
      )
    );

  if (targets.length === 0) {
    logger.info("No custodial primary wallets found. Nothing to do.");
    await pool.end();
    process.exit(0);
  }

  logger.info({ count: targets.length }, "Found wallets to mint");

  let successCount = 0;
  let failureCount = 0;

  for (const target of targets) {
    logger.info(
      {
        userId: target.userId.toString(),
        email: target.email,
        address: target.address,
      },
      "Minting tokens..."
    );

    const result = await mintTokens(target.address, amountWei);

    if (result.isOk()) {
      logger.info(
        {
          userId: target.userId.toString(),
          email: target.email,
          txHash: result.value,
        },
        "Mint successful"
      );
      successCount++;
    } else {
      logger.error(
        {
          userId: target.userId.toString(),
          email: target.email,
          error: result.error.toLog(),
        },
        "Mint failed"
      );
      failureCount++;
    }
  }

  logger.info({ successCount, failureCount, total: targets.length }, "Done");

  await pool.end();
  process.exit(failureCount > 0 ? 1 : 0);
}

run().catch(async (err) => {
  logger.error({ err }, "Unhandled error during mint script");
  await pool.end();
  process.exit(1);
});
