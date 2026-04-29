/**
 * Dev-only mock for Stripe Connect operations.
 * Mirrors the real stripe.service.ts interface but returns fake IDs
 * without making any network calls to Stripe.
 */
import { logger } from "../lib/logger";

const TIMESTAMP_LENGTH = 36;
const RANDOM_LENGTH = 36;
const RANDOM_SUBSTRING_LENGTH = 8;

function generateDevId(prefix: string): string {
  const timestamp = Date.now().toString(TIMESTAMP_LENGTH);
  const random = Math.random()
    .toString(RANDOM_LENGTH)
    .substring(RANDOM_SUBSTRING_LENGTH);
  return `${prefix}_dev_${timestamp}_${random}`;
}

export function createConnectedAccount(
  _email: string,
  _idempotencyKey: string
): Promise<string> {
  const id = generateDevId("acct");
  logger.info(
    { connectedAccountId: id },
    "[MOCK] Created Stripe Connect account"
  );
  return Promise.resolve(id);
}

export function addBankAccount(
  connectedAccountId: string,
  bankDetails: {
    routingNumber: string;
    accountNumber: string;
    accountHolderName: string;
    accountHolderType: "individual" | "company";
  },
  _idempotencyKey: string
): Promise<string> {
  const id = generateDevId("ba");
  logger.info(
    { connectedAccountId, bankAccountId: id, bankDetails },
    "[MOCK] Added bank account to connected account"
  );
  return Promise.resolve(id);
}

export function createTransfer(
  netAmountCents: number,
  connectedAccountId: string,
  _idempotencyKey: string
): Promise<string> {
  const id = generateDevId("tr");
  logger.info(
    { connectedAccountId, transferId: id, netAmountCents },
    "[MOCK] Created platform transfer"
  );
  return Promise.resolve(id);
}

export function createPayout(
  netAmountCents: number,
  connectedAccountId: string,
  bankAccountId: string,
  _idempotencyKey: string
): Promise<string> {
  const id = generateDevId("po");
  logger.info(
    { connectedAccountId, bankAccountId, payoutId: id, netAmountCents },
    "[MOCK] Created bank payout"
  );
  return Promise.resolve(id);
}
