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

type MintTransactionParams = {
  networkId: number;
  toAddress: string;
  tokenAmount: string;
  createdAt: Date;
  isConfirmed: boolean;
};

function buildMintTransactionValues(
  params: MintTransactionParams
): typeof blockchainTransactions.$inferInsert {
  return {
    networkId: params.networkId,
    transactionTypeId: TX_TYPE_MINT,
    fromAddress: MOCK_CONTRACT_ADDRESS,
    toAddress: params.toAddress,
    txHash: generateTransactionHash(),
    blockNumber: BigInt(faker.number.int({ min: 5_000_000, max: 7_000_000 })),
    blockHash: params.isConfirmed ? generateBlockHash() : undefined,
    amount: params.tokenAmount,
    nonce: BigInt(faker.number.int({ min: 0, max: 1000 })),
    gasUsed: BigInt(faker.number.int({ min: 21_000, max: 200_000 })),
    gasPriceWei: String(
      faker.number.bigInt({
        min: 1_000_000_000n,
        max: 50_000_000_000n,
      })
    ),
    isConfirmed: params.isConfirmed,
    confirmations: params.isConfirmed
      ? faker.number.int({ min: 12, max: 200 })
      : 0,
    createdAt: params.createdAt,
    confirmedAt: params.isConfirmed
      ? faker.date.between({ from: params.createdAt, to: new Date() })
      : undefined,
  };
}

type DepositRecordParams = {
  userId: bigint;
  walletId: bigint;
  scenario: "completed" | "pending" | "failedNoTx" | "hybridFailed";
  amountCents: bigint;
  feeCents: bigint;
  tokenAmount: string;
  blockchainTxId: bigint | undefined;
  confirmedAt: Date | undefined;
  createdAt: Date;
};

function buildDepositRecord(
  params: DepositRecordParams
): typeof deposits.$inferInsert {
  return {
    userId: params.userId,
    walletId: params.walletId,
    statusId: getDepositStatusId(params.scenario),
    stripeSessionId: generateStripeSessionId(),
    stripePaymentIntentId:
      params.scenario !== "pending"
        ? generateStripePaymentIntentId()
        : undefined,
    stripeCustomerId:
      params.scenario === "completed" || params.scenario === "hybridFailed"
        ? generateStripeCustomerId()
        : undefined,
    amountCents: params.amountCents,
    feeCents: params.feeCents,
    tokenAmount: params.tokenAmount,
    exchangeRate: "1.00000000",
    blockchainTxId: params.blockchainTxId,
    idempotencyKey: generateIdempotencyKey(),
    ipAddress: faker.internet.ipv4(),
    userAgent: generateUserAgent(),
    createdAt: params.createdAt,
    completedAt:
      params.scenario === "completed"
        ? faker.date.between({
            from: params.confirmedAt ?? params.createdAt,
            to: new Date(),
          })
        : undefined,
  };
}

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
    const userDeposits: SeededDeposit[] = [];

    for (let i = 0; i < count; i++) {
      const scenario = weightedRandom(statusWeights) ?? "completed";
      const amountCents = generateDepositAmount(user.kycStatusId);
      const feeCents = calculateFee(amountCents);
      const tokenAmount = centsToTokenWei(amountCents);
      const createdAt = faker.date.between({
        from: user.createdAt,
        to: new Date(),
      });

      // Per-record transaction: blockchain_transactions + deposit are atomic
      const [depositRecord] = await db.transaction(async (tx) => {
        let blockchainTxId: bigint | undefined;
        let confirmedAt: Date | undefined;

        // Create blockchain_transactions for completed/hybridFailed
        if (scenario === "completed" || scenario === "hybridFailed") {
          const isConfirmed = scenario === "completed";
          confirmedAt = isConfirmed
            ? faker.date.between({ from: createdAt, to: new Date() })
            : undefined;

          const [btx] = await tx
            .insert(blockchainTransactions)
            .values(
              buildMintTransactionValues({
                networkId,
                toAddress: primaryWallet.address,
                tokenAmount,
                createdAt,
                isConfirmed,
              })
            )
            .returning({ id: blockchainTransactions.id });

          blockchainTxId = btx?.id;
        }

        return tx
          .insert(deposits)
          .values(
            buildDepositRecord({
              userId: user.id,
              walletId: primaryWallet.id,
              scenario,
              amountCents,
              feeCents,
              tokenAmount,
              blockchainTxId,
              confirmedAt,
              createdAt,
            })
          )
          .returning({
            id: deposits.id,
            userId: deposits.userId,
            walletId: deposits.walletId,
            statusId: deposits.statusId,
          });
      });

      userDeposits.push(depositRecord as unknown as SeededDeposit);
    }

    result.set(user.id, userDeposits);
  }

  logger.info(`Created deposits for ${eligibleUsers.length} verified users`);
  return result;
}
