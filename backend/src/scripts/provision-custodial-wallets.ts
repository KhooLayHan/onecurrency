/**
 * One-off script: provisions custodial wallets for all existing users who lack one.
 * Safe to re-run — provisionCustodialWallet skips users that already have a primary wallet.
 *
 * Usage: bun run src/scripts/provision-custodial-wallets.ts
 */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema/users";
import { wallets } from "../db/schema/wallets";
import { logger } from "../lib/logger";
import { WalletService } from "../services/wallet.service";

const walletService = new WalletService(db);

async function run() {
  logger.info("Scanning for users without a custodial wallet...");

  const usersWithoutCustodialWallet = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .leftJoin(
      wallets,
      and(
        eq(wallets.userId, users.id),
        eq(wallets.walletType, "CUSTODIAL"),
        isNull(wallets.deletedAt)
      )
    )
    .where(isNull(wallets.id));

  if (usersWithoutCustodialWallet.length === 0) {
    logger.info("All users already have a custodial wallet. Nothing to do.");
    return;
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

  if (failureCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  logger.error({ err }, "Unhandled error during provisioning script");
  process.exit(1);
});
