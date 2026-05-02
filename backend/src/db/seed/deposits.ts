import { faker } from "@faker-js/faker";
import { db } from "@/src/db";
import { logger } from "@/src/lib/logger";
import { blockchainTransactions } from "../schema/blockchain-transactions";
import { deposits } from "../schema/deposits";
import { defaultSeedConfig } from "./config";
import {
  calculateFee,
  centsToTokenWei,
  generateBlockHash,
  generateDepositAmount,
  generateIdempotencyKey,
  generateStripeCustomerId,
  generateStripePaymentIntentId,
  generateStripeSessionId,
  generateTransactionHash,
  generateUserAgent,
  randomBetween,
  weightedRandom,
} from "./helpers";
import type {
  SeededDeposit,
  SeededDepositsByUser,
  SeededWalletsByUser,
} from "./types";

// Mock Sepolia contract address — consistent across all seed deposits
const MOCK_CONTRACT_ADDRESS = "0x4ed7c70f96b99c776995fb64377f0d4ab3b0e1c1";

const STATUS_IDS = {
  pending: 1,
  processing: 2,
  completed: 3,
  failed: 4,
  refunded: 5,
} as const;
const TX_TYPE_MINT = 1;
const KYC_STATUS_VERIFIED = 3;

function getDepositStatusId(
  scenario: "completed" | "pending" | "failedNoTx" | "hybridFailed"
): number {
  if (scenario === "completed") {
    return STATUS_IDS.completed;
  }
  if (scenario === "pending") {
    return STATUS_IDS.pending;
  }
  return STATUS_IDS.failed;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: seeding function — data generation is inherently complex
export async function seedDeposits(
  walletsByUser: SeededWalletsByUser,
  users: Array<{ id: bigint; kycStatusId: number; createdAt: Date }>,
  networkId: number
): Promise<SeededDepositsByUser> {
  const { min, max } = defaultSeedConfig.deposits.perUser;
  const { completed, pending, failedNoTx, hybridFailed } =
    defaultSeedConfig.deposits.statusDistribution;

  const statusWeights = [
    { value: "completed" as const, weight: completed },
    { value: "pending" as const, weight: pending },
    { value: "failedNoTx" as const, weight: failedNoTx },
    { value: "hybridFailed" as const, weight: hybridFailed },
  ];

  // Only verified users (kycStatusId = 3) with wallets get deposits
  const eligibleUsers = users.filter(
    (u) => u.kycStatusId === KYC_STATUS_VERIFIED && walletsByUser.has(u.id)
  );

  const result: SeededDepositsByUser = new Map();

  for (const user of eligibleUsers) {
    const userWallets = walletsByUser.get(user.id);
    if (!userWallets || userWallets.length === 0) {
      continue;
    }

    const primaryWallet =
      userWallets.find((w) => w.isPrimary) ?? userWallets[0];
    if (!primaryWallet) {
      continue;
    }

    const count = randomBetween(min, max);
    const userDeposits: {
      userId: bigint;
      walletId: bigint;
      statusId: number;
      stripeSessionId: string;
      stripePaymentIntentId?: string;
      stripeCustomerId?: string;
      amountCents: bigint;
      feeCents: bigint;
      tokenAmount: string;
      exchangeRate: string;
      blockchainTxId?: bigint;
      idempotencyKey: string;
      ipAddress: string;
      userAgent: string;
      createdAt: Date;
      completedAt?: Date;
    }[] = [];

    for (let i = 0; i < count; i++) {
      const scenario = weightedRandom(statusWeights) ?? "completed";
      const amountCents = generateDepositAmount(user.kycStatusId);
      const feeCents = calculateFee(amountCents);
      const tokenAmount = centsToTokenWei(amountCents);
      const createdAt = faker.date.between({
        from: user.createdAt,
        to: new Date(),
      });

      let blockchainTxId: bigint | undefined;
      let confirmedAt: Date | undefined;

      // Create blockchain_transactions for completed/hybridFailed
      if (scenario === "completed" || scenario === "hybridFailed") {
        const isConfirmed = scenario === "completed";
        const txHash = generateTransactionHash();
        const blockNumber = BigInt(
          faker.number.int({ min: 5_000_000, max: 7_000_000 })
        );
        confirmedAt = isConfirmed
          ? faker.date.between({ from: createdAt, to: new Date() })
          : undefined;

        const [tx] = await db
          .insert(blockchainTransactions)
          .values({
            networkId,
            transactionTypeId: TX_TYPE_MINT,
            fromAddress: MOCK_CONTRACT_ADDRESS,
            toAddress: primaryWallet.address,
            txHash,
            blockNumber,
            blockHash: isConfirmed ? generateBlockHash() : undefined,
            amount: tokenAmount,
            nonce: BigInt(faker.number.int({ min: 0, max: 1000 })),
            gasUsed: BigInt(faker.number.int({ min: 21_000, max: 200_000 })),
            gasPriceWei: String(
              faker.number.bigInt({
                min: 1_000_000_000n,
                max: 50_000_000_000n,
              })
            ),
            isConfirmed,
            confirmations: isConfirmed
              ? faker.number.int({ min: 12, max: 200 })
              : 0,
            createdAt,
            confirmedAt,
          })
          .returning({ id: blockchainTransactions.id });

        blockchainTxId = tx?.id;
      }

      userDeposits.push({
        userId: user.id,
        walletId: primaryWallet.id,
        statusId: getDepositStatusId(scenario),
        stripeSessionId: generateStripeSessionId(),
        stripePaymentIntentId:
          scenario !== "pending" ? generateStripePaymentIntentId() : undefined,
        stripeCustomerId:
          scenario === "completed" || scenario === "hybridFailed"
            ? generateStripeCustomerId()
            : undefined,
        amountCents,
        feeCents,
        tokenAmount,
        exchangeRate: "1.00000000",
        blockchainTxId,
        idempotencyKey: generateIdempotencyKey(),
        ipAddress: faker.internet.ipv4(),
        userAgent: generateUserAgent(),
        createdAt,
        // completedAt must be after on-chain confirmation
        completedAt:
          scenario === "completed"
            ? faker.date.between({
                from: confirmedAt ?? createdAt,
                to: new Date(),
              })
            : undefined,
      });
    }

    // Insert deposits for this user
    const inserted = await db.insert(deposits).values(userDeposits).returning({
      id: deposits.id,
      userId: deposits.userId,
      walletId: deposits.walletId,
      statusId: deposits.statusId,
    });

    result.set(user.id, inserted as SeededDeposit[]);
  }

  logger.info(`Created deposits for ${eligibleUsers.length} verified users`);
  return result;
}
