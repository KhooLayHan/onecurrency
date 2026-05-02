import { faker } from "@faker-js/faker";
import { db } from "@/src/db";
import { logger } from "@/src/lib/logger";
import { blockchainTransactions } from "../schema/blockchain-transactions";
import { withdrawals } from "../schema/withdrawals";
import { defaultSeedConfig } from "./config";
import {
  batchInsert,
  calculateFee,
  centsToTokenWei,
  generateBlockHash,
  generateStripePayoutId,
  generateStripeTransferId,
  generateTransactionHash,
  randomBetween,
  weightedRandom,
} from "./helpers";
import type { SeededWalletsByUser } from "./types";

const MOCK_CONTRACT_ADDRESS = "0x4ed7c70f96b99c776995fb64377f0d4ab3b0e1c1";
const TX_TYPE_BURN = 2;
const STATUS_IDS = { pending: 1, completed: 3, failed: 4 } as const;
const WITHDRAWAL_SAMPLING_RATE = 0.4;
const KYC_STATUS_VERIFIED = 3;

function getWithdrawalStatusId(
  scenario: "completed" | "pending" | "failed"
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
export async function seedWithdrawals(
  walletsByUser: SeededWalletsByUser,
  users: Array<{
    id: bigint;
    kycStatusId: number;
    email: string;
    createdAt: Date;
  }>,
  networkId: number,
  withdrawDemoUserId: bigint
): Promise<void> {
  const { min, max } = defaultSeedConfig.withdrawals.perUser;
  const { completed, pending, failed } =
    defaultSeedConfig.withdrawals.statusDistribution;

  const statusWeights = [
    { value: "completed" as const, weight: completed },
    { value: "pending" as const, weight: pending },
    { value: "failed" as const, weight: failed },
  ];

  const eligibleUsers = users.filter((u) => {
    if (!walletsByUser.has(u.id)) {
      return false;
    }
    if (u.id === withdrawDemoUserId) {
      return true;
    }
    if (u.kycStatusId !== KYC_STATUS_VERIFIED) {
      return false;
    }
    return faker.number.float({ min: 0, max: 1 }) < WITHDRAWAL_SAMPLING_RATE;
  });

  const records: {
    userId: bigint;
    walletId: bigint;
    statusId: number;
    tokenAmount: string;
    fiatAmountCents: bigint;
    feeCents: bigint;
    exchangeRate: string;
    payoutMethod: string;
    blockchainTxId?: bigint;
    stripeTransferId?: string;
    stripePayoutId?: string;
    createdAt: Date;
    completedAt?: Date;
  }[] = [];

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

    const isDemoUser = user.id === withdrawDemoUserId;
    const count = isDemoUser ? max : randomBetween(min, max);

    for (let i = 0; i < count; i++) {
      const scenario =
        isDemoUser && i === 0
          ? "completed"
          : (weightedRandom(statusWeights) ?? "completed");

      const fiatAmountCents = BigInt(
        faker.number.int({ min: 1000, max: 50_000 })
      );
      const feeCents = calculateFee(fiatAmountCents);
      const tokenAmount = centsToTokenWei(fiatAmountCents);
      const createdAt = faker.date.between({
        from: user.createdAt,
        to: new Date(),
      });

      let blockchainTxId: bigint | undefined;

      if (scenario === "completed") {
        const [tx] = await db
          .insert(blockchainTransactions)
          .values({
            networkId,
            transactionTypeId: TX_TYPE_BURN,
            fromAddress: primaryWallet.address,
            toAddress: MOCK_CONTRACT_ADDRESS,
            txHash: generateTransactionHash(),
            blockNumber: BigInt(
              faker.number.int({ min: 5_000_000, max: 7_000_000 })
            ),
            blockHash: generateBlockHash(),
            amount: tokenAmount,
            nonce: BigInt(faker.number.int({ min: 0, max: 1000 })),
            gasUsed: BigInt(faker.number.int({ min: 21_000, max: 200_000 })),
            gasPriceWei: String(
              faker.number.bigInt({
                min: 1_000_000_000n,
                max: 50_000_000_000n,
              })
            ),
            isConfirmed: true,
            confirmations: faker.number.int({ min: 12, max: 200 }),
            createdAt,
            confirmedAt: faker.date.between({
              from: createdAt,
              to: new Date(),
            }),
          })
          .returning({ id: blockchainTransactions.id });

        blockchainTxId = tx?.id;
      }

      records.push({
        userId: user.id,
        walletId: primaryWallet.id,
        statusId: getWithdrawalStatusId(scenario),
        tokenAmount,
        fiatAmountCents,
        feeCents,
        exchangeRate: "1.00000000",
        payoutMethod: "bank_transfer",
        blockchainTxId,
        stripeTransferId:
          scenario === "completed" ? generateStripeTransferId() : undefined,
        stripePayoutId:
          scenario === "completed" ? generateStripePayoutId() : undefined,
        createdAt,
        completedAt:
          scenario === "completed"
            ? faker.date.between({ from: createdAt, to: new Date() })
            : undefined,
      });
    }
  }

  await batchInsert(withdrawals, records, { batchSize: 50 });
  logger.info(`Created withdrawals for ${eligibleUsers.length} users`);
}
