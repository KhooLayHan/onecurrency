import { faker } from "@faker-js/faker";
import { db } from "@/src/db";
import type { NewWallet } from "../schema/wallets";
import { wallets } from "../schema/wallets";
import type { WalletSeedConfig } from "./config";
import {
  generateEthereumAddress,
  generateProviderName,
  generateWalletLabel,
  randomBetween,
} from "./helpers";

export async function seedWallets(
  users: Array<{ id: bigint; createdAt: Date }>,
  config: WalletSeedConfig,
  networkId: number = 1, // Sepolia default
): Promise<
  Array<{
    id: bigint;
    userId: bigint;
    address: string;
    isPrimary: boolean;
  }>
> {
  const walletRecords: NewWallet[] = [];

  for (const user of users) {
    const walletCount = randomBetween(config.perUser.min, config.perUser.max);

    for (let i = 0; i < walletCount; i++) {
      const isPrimary = i === 0;
      const walletType = faker.datatype.boolean(0.2) ? "CUSTODIAL" : "EXTERNAL";
      const address = generateEthereumAddress();

      walletRecords.push({
        userId: user.id,
        networkId,
        address,
        label: generateWalletLabel(isPrimary, i),
        isPrimary,
        walletType,
        providerName: generateProviderName(walletType),
        encryptedPrivateKey:
          walletType === "CUSTODIAL"
            ? faker.string.alphanumeric(64) // Placeholder encrypted key
            : undefined,
        createdAt: faker.date.between({ from: user.createdAt, to: new Date() }),
        updatedAt: faker.date.between({ from: user.createdAt, to: new Date() }),
      });
    }
  }

  // Insert in batches
  const createdWallets: Array<{
    id: bigint;
    userId: bigint;
    address: string;
    isPrimary: boolean;
  }> = [];

  for (let i = 0; i < walletRecords.length; i += 50) {
    const batch = walletRecords.slice(i, i + 50);

    const result = await db.insert(wallets).values(batch).returning({
      id: wallets.id,
      userId: wallets.userId,
      address: wallets.address,
      isPrimary: wallets.isPrimary,
    });

    createdWallets.push(...result);
  }

  console.log(`Created ${createdWallets.length} wallets`);
  return createdWallets;
}
