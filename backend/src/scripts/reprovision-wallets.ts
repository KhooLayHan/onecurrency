/**
 * One-time migration: re-provisions custodial wallets for users who were
 * assigned to the wrong network (Hardhat in production).
 *
 * Usage:
 *   NODE_ENV=production bun run src/scripts/reprovision-wallets.ts
 */
import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/src/db";
import { networks } from "@/src/db/schema/networks";
import { wallets } from "@/src/db/schema/wallets";
import { logger } from "@/src/lib/logger";
import { activeChainId } from "@/src/services/blockchain/client";
import { WalletService } from "@/src/services/wallet.service";

const walletService = new WalletService(db);

const [correctNetwork] = await db
  .select({ id: networks.id })
  .from(networks)
  .where(eq(networks.chainId, BigInt(activeChainId)))
  .limit(1);
if (!correctNetwork) {
  logger.error({ activeChainId }, "Correct network not found in DB — aborting");
  process.exit(1);
}

// Find all users whose primary custodial wallet is on the WRONG network
const affected = await db
  .select({ userId: wallets.userId })
  .from(wallets)
  .where(
    and(
      eq(wallets.walletType, "CUSTODIAL"),
      eq(wallets.isPrimary, true),
      isNull(wallets.deletedAt),
      ne(wallets.networkId, correctNetwork.id)
    )
  );

logger.info({ count: affected.length, activeChainId }, "Affected users found");
for (const { userId } of affected) {
  const result = await walletService.provisionCustodialWallet(userId);
  if (result.isErr()) {
    logger.error(
      { err: result.error, userId: userId.toString() },
      "Re-provision failed"
    );
  } else {
    logger.info(
      { userId: userId.toString(), address: result.value.address },
      "Re-provisioned"
    );
  }
}

logger.info("Done");
process.exit(0);
