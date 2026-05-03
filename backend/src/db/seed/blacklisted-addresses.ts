import { faker } from "@faker-js/faker";
import { logger } from "@/src/lib/logger";
import { blacklistedAddresses } from "../schema/blacklisted-addresses";
import { batchInsert, generateEthereumAddress } from "./helpers";
import type { SeededWalletsByUser } from "./types";

const SOURCES = ["OFAC", "internal", "chainalysis"] as const;

const BLACKLIST_REASONS = [
  "Associated with known fraud ring",
  "Flagged by OFAC sanctions list",
  "Suspected money laundering activity",
  "Linked to phishing campaign",
];

const EXTRA_BLACKLIST_COUNT = 3;

export async function seedBlacklistedAddresses(
  walletsByUser: SeededWalletsByUser,
  blacklistDemoUserId: bigint,
  complianceUserId: bigint,
  networkId: number
): Promise<void> {
  const records: {
    address: string;
    networkId: number;
    reason: string;
    source: string;
    addedByUserId: bigint;
  }[] = [];

  // 1. Blacklist the demo user's primary wallet address
  const demoWallets = walletsByUser.get(blacklistDemoUserId);
  if (demoWallets && demoWallets.length > 0) {
    const primaryWallet =
      demoWallets.find((w) => w.isPrimary) ?? demoWallets[0];
    if (primaryWallet) {
      records.push({
        address: primaryWallet.address,
        networkId,
        reason: "Demo blacklisted address — used for presentation",
        source: "internal" as const,
        addedByUserId: complianceUserId,
      });
    }
  }

  // 2. A few extra random addresses for realism
  for (let i = 0; i < EXTRA_BLACKLIST_COUNT; i++) {
    records.push({
      address: generateEthereumAddress(),
      networkId,
      reason: faker.helpers.arrayElement(BLACKLIST_REASONS),
      source: faker.helpers.arrayElement(SOURCES),
      addedByUserId: complianceUserId,
    });
  }

  await batchInsert(blacklistedAddresses, records, { batchSize: 50 });
  logger.info(`Created ${records.length} blacklisted addresses`);
}
