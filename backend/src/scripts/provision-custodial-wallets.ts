/**
 * One-off script: provisions custodial wallets for all existing users who lack one.
 * Safe to re-run — provisionCustodialWallet skips users that already have a
 * custodial primary wallet on the active network.
 *
 * Usage: bun run src/scripts/provision-custodial-wallets.ts
 */
import { and, asc, eq, isNull } from "drizzle-orm";
import { db, pool } from "../db";
import { networks } from "../db/schema/networks";
import { users } from "../db/schema/users";
import { wallets } from "../db/schema/wallets";
import { logger } from "../lib/logger";
import { WalletService } from "../services/wallet.service";

const walletService = new WalletService(db);

async function run() {
  logger.info("Scanning for users without a custodial wallet...");

  const activeNetwork = await db
    .select({ id: networks.id })
    .from(networks)
    .where(eq(networks.isActive, true))
    .orderBy(asc(networks.id))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!activeNetwork) {
    logger.error("No active network found. Cannot proceed.");
    await pool.end();
    process.exit(1);
  }

  const usersWithoutCustodialWallet = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .leftJoin(
      wallets,
      and(
        eq(wallets.userId, users.id),
        eq(wallets.walletType, "CUSTODIAL"),
        eq(wallets.networkId, activeNetwork.id),
        eq(wallets.isPrimary, true),
        isNull(wallets.deletedAt)
      )
    )
    .where(and(isNull(wallets.id), isNull(users.deletedAt)));

  if (usersWithoutCustodialWallet.length === 0) {
    logger.info("All users already have a custodial wallet. Nothing to do.");
    await pool.end();
    process.exit(0);
  }

  logger.info(
    { count: usersWithoutCustodialWallet.length },
    "Found users without custodial wallet — provisioning..."
  );

  let successCount = 0;
  let failureCount = 0;

  for (const user of usersWithoutCustodialWallet) {
    const result = await walletService.provisionCustodialWallet(user.id);
    if (result.isOk()) {
      logger.info(
        {
          userId: user.id.toString(),
          email: user.email,
          address: result.value.address,
        },
        "Custodial wallet provisioned"
      );
      successCount++;
    } else {
      logger.error(
        { userId: user.id.toString(), email: user.email, err: result.error },
        "Failed to provision custodial wallet"
      );
      failureCount++;
    }
  }

  logger.info({ successCount, failureCount }, "Provisioning complete");

  await pool.end();
  process.exit(failureCount > 0 ? 1 : 0);
}

run().catch(async (err) => {
  logger.error({ err }, "Unhandled error during provisioning script");
  await pool.end();
  process.exit(1);
});
