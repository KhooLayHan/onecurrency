import { faker } from "@faker-js/faker";
import { db } from "@/src/db";
import { logger } from "@/src/lib/logger";
import type { NewWallet } from "../schema/wallets";
import { wallets } from "../schema/wallets";
import { defaultSeedConfig } from "./config";
import { generateEthereumAddress, randomBetween } from "./helpers";
import type { SeededWallet } from "./types";

// Query Sepolia network ID
async function getSepoliaNetworkId(): Promise<number> {
  const network = await db._query.networks.findFirst({
    where: (networks, { eq }) => eq(networks.name, "Sepolia"),
  });
  if (!network) {
    throw new Error("Sepolia network not found");
  }
  return network.id;
}

// Generate wallet label
function generateWalletLabel(isPrimary: boolean): string {
  if (isPrimary) {
    return faker.helpers.arrayElement([
      "Main Wallet",
      "Primary Wallet",
      "Trading Wallet",
    ]);
  }
  return faker.helpers.arrayElement([
    "Savings",
    "Backup",
    "DApp Wallet",
    "Secondary",
  ]);
}

// Generate provider name for external wallets
function generateProviderName(): string {
  return faker.helpers.weightedArrayElement([
    { value: "MetaMask", weight: 70 },
    { value: "WalletConnect", weight: 20 },
    { value: "Coinbase Wallet", weight: 10 },
  ]);
}

// Check if user already has wallets
async function userHasWallets(userId: bigint): Promise<boolean> {
  const existing = await db._query.wallets.findFirst({
    where: (wallets, { eq }) => eq(wallets.userId, userId),
  });
  return !!existing;
}

// Seed wallets for users
export async function seedWallets(
  users: Array<{ id: bigint; createdAt: Date }>
): Promise<
  Array<{ id: bigint; userId: bigint; address: string; isPrimary: boolean }>
> {
  const networkId = await getSepoliaNetworkId();
  const { min, max } = defaultSeedConfig.wallets.perUser;

  const walletRecords: NewWallet[] = [];
  const skippedUsers: bigint[] = [];

  const EXTERNAL_80_PERCENT = 0.8;
  const CUSTODIAL_ENCRYPTED_PRIVATE_KEY_LENGTH = 64;

  for (const user of users) {
    // Skip users that already have wallets
    if (await userHasWallets(user.id)) {
      skippedUsers.push(user.id);
      continue;
    }

    const walletCount = randomBetween(min, max);

    for (let i = 0; i < walletCount; i++) {
      const isPrimary = i === 0;
      const isExternal = faker.datatype.boolean(EXTERNAL_80_PERCENT); // 80% external
      const walletType = isExternal ? "EXTERNAL" : "CUSTODIAL";
      const createdAt = faker.date.between({
        from: user.createdAt,
        to: new Date(),
      });

      walletRecords.push({
        userId: user.id,
        networkId,
        address: generateEthereumAddress(),
        label: generateWalletLabel(isPrimary),
        isPrimary,
        walletType,
        providerName: isExternal ? generateProviderName() : undefined,
        encryptedPrivateKey: isExternal
          ? undefined
          : faker.string.alphanumeric(CUSTODIAL_ENCRYPTED_PRIVATE_KEY_LENGTH),
        createdAt,
        updatedAt: faker.date.between({ from: createdAt, to: new Date() }),
      });
    }
  }

  if (skippedUsers.length > 0) {
    logger.info(
      `Skipped ${skippedUsers.length} users that already have wallets`
    );
  }
  if (walletRecords.length === 0) {
    logger.info("No wallets to create");
    return new Map();
  }

  // Batch insert with onConflictDoNothing to handle any duplicate addresses
  const created: SeededWallet[] = [];

  // Batch insert with returning
  //   const created = await batchInsertReturning(wallets, walletRecords, {
  //     returning: {
  //       id: wallets.id,
  //       userId: wallets.userId,
  //       address: wallets.address,
  //       isPrimary: wallets.isPrimary,
  //     },
  //   });

  for (const batch of generateBatches(walletRecords, 50)) {
    const batchResult = await db
      .insert(wallets)
      .values(batch)
      .onConflictDoNothing()
      .returning({
        id: wallets.id,
        userId: wallets.userId,
        address: wallets.address,
        isPrimary: wallets.isPrimary,
      });

    created.push(...(batchResult as SeededWallet[]));
  }
  // Group by user ID
  const grouped = new Map<bigint, SeededWallet[]>();
  for (const wallet of created) {
    const userWallets = grouped.get(wallet.userId) ?? [];
    userWallets.push(wallet);
    grouped.set(wallet.userId, userWallets);
  }

  logger.info(`Created ${created.length} wallets for ${users.length} users`);
  //   return created as Array<{
  //     id: bigint;
  //     userId: bigint;
  //     address: string;
  //     isPrimary: boolean;
  //   }>;
  return grouped;
}
