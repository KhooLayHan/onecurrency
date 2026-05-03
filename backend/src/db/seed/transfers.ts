import { faker } from "@faker-js/faker";
import { db } from "@/src/db";
import { logger } from "@/src/lib/logger";
import { blockchainTransactions } from "../schema/blockchain-transactions";
import { transfers } from "../schema/transfers";
import { defaultSeedConfig } from "./config";
import {
  calculateFee,
  centsToTokenWei,
  generateBlockHash,
  generateIdempotencyKey,
  generateTransactionHash,
  randomBetween,
  weightedRandom,
} from "./helpers";
import { getKycStatusIds } from "./lookup";
import type { SeededWalletsByUser } from "./types";

const TX_TYPE_TRANSFER = 3;
const STATUS_IDS = { pending: 1, completed: 3, failed: 4 } as const;
const TRANSFER_SAMPLING_RATE = 0.3;
const DEMO_TRANSFER_MIN_RECEIVERS = 3;
const DEMO_TRANSFER_MAX_RECEIVERS = 5;
const TRANSFER_NOTE_PROBABILITY = 0.3;

function getTransferStatusId(
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
export async function seedTransfers(
  walletsByUser: SeededWalletsByUser,
  users: Array<{ id: bigint; kycStatusId: number; createdAt: Date }>,
  networkId: number,
  transferDemoUserId: bigint
): Promise<void> {
  const { min, max } = defaultSeedConfig.transfers.perPair;
  const { completed, pending, failed } =
    defaultSeedConfig.transfers.statusDistribution;

  // Resolve verified KYC status ID at runtime — never assume a hardcoded value
  const kycIds = await getKycStatusIds();

  const statusWeights = [
    { value: "completed" as const, weight: completed },
    { value: "pending" as const, weight: pending },
    { value: "failed" as const, weight: failed },
  ];

  const verifiedWithWallets = users.filter(
    (u) => u.kycStatusId === kycIds.verified && walletsByUser.has(u.id)
  );

  // Build transfer pairs
  type UserData = (typeof verifiedWithWallets)[0];
  type Pair = { sender: UserData; receiver: UserData };
  const pairs: Pair[] = [];

  const demoUser = verifiedWithWallets.find((u) => u.id === transferDemoUserId);
  const otherVerified = verifiedWithWallets.filter(
    (u) => u.id !== transferDemoUserId
  );

  // Demo user sends to up to 5 random receivers
  if (demoUser && otherVerified.length > 0) {
    const receivers = faker.helpers.arrayElements(otherVerified, {
      min: Math.min(DEMO_TRANSFER_MIN_RECEIVERS, otherVerified.length),
      max: Math.min(DEMO_TRANSFER_MAX_RECEIVERS, otherVerified.length),
    });
    for (const receiver of receivers) {
      pairs.push({ sender: demoUser, receiver });
    }
  }

  // Random pairs among regular verified users (~30% sampled as senders)
  const sampledSenders = otherVerified.filter(
    () => faker.number.float({ min: 0, max: 1 }) < TRANSFER_SAMPLING_RATE
  );
  for (const sender of sampledSenders) {
    const possibleReceivers = otherVerified.filter((u) => u.id !== sender.id);
    if (possibleReceivers.length === 0) {
      continue;
    }
    const receiver = faker.helpers.arrayElement(possibleReceivers);
    pairs.push({ sender, receiver });
  }

  for (const { sender, receiver } of pairs) {
    const senderWallets = walletsByUser.get(sender.id);
    const receiverWallets = walletsByUser.get(receiver.id);
    if (!(senderWallets && receiverWallets)) {
      continue;
    }

    const senderWallet =
      senderWallets.find((w) => w.isPrimary) ?? senderWallets[0];
    const receiverWallet =
      receiverWallets.find((w) => w.isPrimary) ?? receiverWallets[0];
    if (!(senderWallet && receiverWallet)) {
      continue;
    }

    const count = randomBetween(min, max);

    for (let i = 0; i < count; i++) {
      const scenario =
        sender.id === transferDemoUserId && i === 0
          ? "completed"
          : (weightedRandom(statusWeights) ?? "completed");
      const amountCents = BigInt(faker.number.int({ min: 500, max: 20_000 }));
      const feeCents = calculateFee(amountCents);
      const tokenAmount = centsToTokenWei(amountCents);
      const createdAt = faker.date.between({
        from: new Date(
          Math.max(sender.createdAt.getTime(), receiver.createdAt.getTime())
        ),
        to: new Date(),
      });

      let confirmedAt: Date | undefined;

      // Per-record transaction: blockchain_transactions + transfer are atomic
      await db.transaction(async (tx) => {
        let blockchainTxId: bigint | undefined;

        if (scenario === "completed") {
          confirmedAt = faker.date.between({ from: createdAt, to: new Date() });

          const [btx] = await tx
            .insert(blockchainTransactions)
            .values({
              networkId,
              transactionTypeId: TX_TYPE_TRANSFER,
              fromAddress: senderWallet.address,
              toAddress: receiverWallet.address,
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
              confirmedAt,
            })
            .returning({ id: blockchainTransactions.id });

          blockchainTxId = btx?.id;
        }

        await tx.insert(transfers).values({
          senderUserId: sender.id,
          receiverUserId: receiver.id,
          senderWalletId: senderWallet.id,
          receiverWalletId: receiverWallet.id,
          statusId: getTransferStatusId(scenario),
          amountCents,
          feeCents,
          tokenAmount,
          blockchainTxId,
          idempotencyKey: generateIdempotencyKey(),
          note:
            faker.number.float({ min: 0, max: 1 }) < TRANSFER_NOTE_PROBABILITY
              ? faker.helpers.arrayElement([
                  "Thanks!",
                  "Rent split",
                  "Dinner",
                  "Paying back",
                ])
              : undefined,
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
      });
    }
  }

  logger.info(`Created transfers across ${pairs.length} pairs`);
}
