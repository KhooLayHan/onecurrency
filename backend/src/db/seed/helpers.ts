import { faker } from "@faker-js/faker";
import { db } from "@/src/db";
import type { PgTable } from "drizzle-orm/pg-core";
import { DEFAULT_BATCH_SIZE } from "./config";
import type { SeededRegularUser } from "./types";
import type { SelectedFieldsFlat } from "drizzle-orm/pg-core";

// Generator for batches (supports for...of)
function* generateBatches<T>(items: T[], batchSize: number): Generator<T[]> {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error("batchSize must be a positive integer");
  }
  
  for (let i = 0; i < items.length; i += batchSize) {
    yield items.slice(i, i + batchSize);
  }
}

// Simple batch insert without returning
export async function batchInsert<T extends Record<string, unknown>>(
  table: PgTable,
  records: T[],
  options: { batchSize?: number } = {}
): Promise<void> {
  const { batchSize = DEFAULT_BATCH_SIZE } = options;

  for (const batch of generateBatches(records, batchSize)) {
    await db.insert(table).values(batch);
  }
}

// Batch insert with returning clause
export async function batchInsertReturning(
  table: PgTable,
  records: Record<string, unknown>[],
  options: {
    batchSize?: number;
    returning: SelectedFieldsFlat;
  }
): Promise<unknown[]> {
  const { batchSize = DEFAULT_BATCH_SIZE, returning } = options;
  const results: unknown[] = [];

  for (const batch of generateBatches(records, batchSize)) {
    const batchResult = await db
      .insert(table)
      .values(batch)
      .returning(returning);
    results.push(...batchResult);
  }

  return results;
}

export function randomBetween(min: number, max: number): number {
  return faker.number.int({ min, max });
}

export function randomPercentage(): number {
  return faker.number.int({ min: 0, max: 99 });
}

export function generateEthereumAddress(): string {
  return `0x${faker.string.hexadecimal({ length: 40, casing: "lower" })}`;
}

export function generateTransactionHash(): string {
  return `0x${faker.string.hexadecimal({ length: 64, casing: "lower" })}`;
}

export function generateBlockHash(): string {
  return `0x${faker.string.hexadecimal({ length: 64, casing: "lower" })}`;
}

export function generateStripeSessionId(): string {
  return `cs_test_${faker.string.alphanumeric(56)}`;
}

export function generateStripeCustomerId(): string {
  return `cus_${faker.string.alphanumeric(14)}`;
}

export function generateStripePaymentIntentId(): string {
  return `pi_${faker.string.alphanumeric(24)}`;
}

export function generateIdempotencyKey(): string {
  return faker.string.uuid();
}

export function weightedRandom<T>(items: { value: T; weight: number }[]) {
  if (!items || items.length === 0) {
    throw new Error("Array cannot be empty");
  }

  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) {
    throw new Error("Total weight must be positive");
  }

  let random = faker.number.int({ min: 0, max: totalWeight - 1 });

  for (const item of items) {
    random -= item.weight;
    if (random < 0) {
      return item.value;
    }
  }

  // Fallback should be unreachable with positive weights, but TypeScript needs this
  // return items[items.length - 1]!.value;
}

export function distributeByPercentage(
  total: number,
  distribution: Record<number, number>
): Map<number, number> {
  const result = new Map<number, number>();
  const totalPercentage = Object.values(distribution).reduce(
    (sum, p) => sum + p,
    0
  );

  if (totalPercentage <= 0) {
    throw new Error("Distribution total percentage must be positive");
  }

  let remaining = total;
  const entries = Object.entries(distribution);

  for (const [key, percentage] of entries) {
    const keyNum = Number.parseInt(key, 10);

    if (entries[entries.length - 1]?.[0] === key) {
      result.set(keyNum, remaining);
    } else {
      const count = Math.floor((total * percentage) / totalPercentage);
      result.set(keyNum, count);
      remaining -= count;
    }
  }

  return result;
}

export function centsToDollars(cents: bigint): string {
  return (Number(cents) / 100).toFixed(2);
}

export function dollarsToCents(dollars: number): bigint {
  return BigInt(Math.round(dollars * 100));
}

export function generateDepositAmount(kycStatusId: number): bigint {
  let minDollars: number;
  let maxDollars: number;

  switch (kycStatusId) {
    case 1: // None
    case 4: // Rejected
    case 5: // Expired
      minDollars = 10;
      maxDollars = 500;
      break;
    case 2: // Pending
      minDollars = 50;
      maxDollars = 1_000;
      break;
    case 3: // Verified
      minDollars = 50;
      maxDollars = 5_000;
      break;
    default:
      minDollars = 10;
      maxDollars = 500;
  }

  const range = maxDollars - minDollars;
  const smallMax = minDollars + range * 0.2;
  const mediumMax = minDollars + range * 0.6;

  const amountDistribution = faker.number.int({ min: 1, max: 100 });

  let amount: number;
  if (amountDistribution <= 60) {
    // 60% small amounts: $10-$100
    amount = faker.number.float({
      min: minDollars,
      max: smallMax,
      fractionDigits: 2,
    });
  } else if (amountDistribution <= 90) {
    // 30% medium amounts: $100-$1_000
    amount = faker.number.float({
      min: smallMax,
      max: mediumMax,
      fractionDigits: 2,
    });
  } else {
    // 10% large amounts: $1_000-$5_000
    amount = faker.number.float({
      min: mediumMax,
      max: maxDollars,
      fractionDigits: 2,
    });
  }

  amount = Math.min(Math.max(amount, minDollars), maxDollars);

  return dollarsToCents(amount);
}

export function calculateFee(amountCents: bigint): bigint {
  const feePercentage = faker.number.float({
    min: 1,
    max: 3,
    fractionDigits: 2,
  });
  return (amountCents * BigInt(Math.round(feePercentage * 100))) / 10_000n;
}

export function generateUserAgent(): string {
  const browsers = ["Chrome", "Firefox", "Safari", "Edge"];
  const browser = faker.helpers.arrayElement(browsers);

  switch (browser) {
    case "Chrome":
      return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${faker.number.int({ min: 120, max: 130 })}.0.0.0 Safari/537.36`;
    case "Firefox":
      return `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${faker.number.int({ min: 120, max: 130 })}.0) Gecko/20100101 Firefox/${faker.number.int({ min: 120, max: 130 })}.0`;
    case "Safari":
      return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${faker.number.int({ min: 16, max: 17 })}.0 Safari/605.1.15`;
    case "Edge":
      return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${faker.number.int({ min: 120, max: 130 })}.0.0.0 Safari/537.36 Edg/${faker.number.int({ min: 120, max: 130 })}.0.0.0`;
    default:
      return faker.internet.userAgent();
  }
}

export function generateProviderName(walletType: string): string | undefined {
  if (walletType === "CUSTODIAL") {
    return;
  }

  const providers = [
    { value: "MetaMask", weight: 70 },
    { value: "WalletConnect", weight: 20 },
    { value: "Coinbase Wallet", weight: 10 },
  ];

  return weightedRandom(
    providers.map((p) => ({ value: p.value, weight: p.weight }))
  );
}

export function generateWalletLabel(isPrimary: boolean, index: number): string {
  if (isPrimary) {
    const primaryLabels = ["Main Wallet", "Primary Wallet", "Trading Wallet"];
    return faker.helpers.arrayElement(primaryLabels);
  }

  const secondaryLabels = [
    "Savings",
    "Backup",
    "DApp Wallet",
    `Wallet ${index + 1}`,
  ];
  return faker.helpers.arrayElement(secondaryLabels);
}
