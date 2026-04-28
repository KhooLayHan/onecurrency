/**
 * Dev-only mock for Stripe Connect operations.
 * Mirrors the real stripe.service.ts interface but returns fake IDs
 * without making any network calls to Stripe.
 */
import { logger } from "../lib/logger";

// Re-export the real helper since it doesn't need mocking
export { calculateTokenAmountWei } from "./stripe.service";

function generateDevId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_dev_${timestamp}_${random}`;
}

export async function createConnectedAccount(
  _email: string,
  _idempotencyKey: string
): Promise<string> {
  const id = generateDevId("acct");
  logger.info({ connectedAccountId: id }, "[MOCK] Created Stripe Connect account");
  return id;
}

export async function addBankAccount(
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
  return id;
}

export async function createTransfer(
  netAmountCents: number,
  connectedAccountId: string,
  _idempotencyKey: string
): Promise<string> {
  const id = generateDevId("tr");
  logger.info(
    { connectedAccountId, transferId: id, netAmountCents },
    "[MOCK] Created platform transfer"
  );
  return id;
}

export async function createPayout(
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
  return id;
}
