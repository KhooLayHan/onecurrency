/**
 * Dev-only script: funds ETH and mints ONE tokens to all active custodial primary wallets.
 * Safe to re-run — adds ETH if low and mints more tokens.
 *
 * Usage:
 *   bun run src/scripts/mint-dev-tokens.ts
 *   bun run src/scripts/mint-dev-tokens.ts --amount=500
 */
import { and, eq, isNull } from "drizzle-orm";
import { parseEther } from "viem";
import { db, pool } from "../db";
import { users } from "../db/schema/users";
import { wallets } from "../db/schema/wallets";
import { logger } from "../lib/logger";
import { mintTokens, walletClient } from "../services/blockchain";

const DEFAULT_MINT_AMOUNT_USD = 1000;
const TOKEN_DECIMALS = 18;
const BASE = 10n;
const WEI_PER_DOLLAR = BASE ** BigInt(TOKEN_DECIMALS);
const ETH_FUND_AMOUNT = "0.05";

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

async function fundWalletWithEth(address: string): Promise<string> {
  const txHash = await walletClient.sendTransaction({
    to: address as `0x${string}`,
    value: parseEther(ETH_FUND_AMOUNT),
  });
  return txHash;
}

async function run() {
  const amountUsd = parseAmountArg(process.argv);
  const amountWei = usdToWei(amountUsd);

  logger.info(
    { amountUsd, amountWei, ethFundAmount: ETH_FUND_AMOUNT },
    "Scanning for custodial primary wallets to fund + mint..."
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

  logger.info({ count: targets.length }, "Found wallets to fund + mint");

  let fundSuccessCount = 0;
  let fundFailureCount = 0;
  let mintSuccessCount = 0;
  let mintFailureCount = 0;

  for (const target of targets) {
    // 1. Fund ETH for gas
    logger.info(
      {
        userId: target.userId.toString(),
        email: target.email,
        address: target.address,
        ethAmount: ETH_FUND_AMOUNT,
      },
      "Funding ETH..."
    );

    try {
      const txHash = await fundWalletWithEth(target.address);
      logger.info(
        {
          userId: target.userId.toString(),
          email: target.email,
          txHash,
        },
        "ETH fund successful"
      );
      fundSuccessCount++;
    } catch (err) {
      logger.error(
        {
          userId: target.userId.toString(),
          email: target.email,
          error: err,
        },
        "ETH fund failed — skipping mint for this wallet"
      );
      fundFailureCount++;
      continue;
    }

    // 2. Mint ONE tokens
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
      mintSuccessCount++;
    } else {
      logger.error(
        {
          userId: target.userId.toString(),
          email: target.email,
          error: result.error.toLog(),
        },
        "Mint failed"
      );
      mintFailureCount++;
    }
  }

  logger.info(
    {
      fundSuccessCount,
      fundFailureCount,
      mintSuccessCount,
      mintFailureCount,
      total: targets.length,
    },
    "Done"
  );

  await pool.end();
  process.exit(fundFailureCount > 0 || mintFailureCount > 0 ? 1 : 0);
}

run().catch(async (err) => {
  logger.error({ err }, "Unhandled error during fund + mint script");
  await pool.end();
  process.exit(1);
});
