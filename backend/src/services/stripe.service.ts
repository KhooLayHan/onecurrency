import Stripe from "stripe";
import { env } from "../env";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-02-25.clover",
  typescript: true,
});

/**
 * Helper to calculate the equivalent tokens for a given fiat amount.
 * For OneCurrency, 1 USD = 1 ONE Token.
 * 100 USD = 10_000 cents = 100 * 10^18 Wei
 */
export function calculateTokenAmountWei(amountCents: number): string {
  const POWER_OF_18 = 18;
  const PRECENTAGE = 100;

  const WEI_PER_DOLLAR = BigInt(10) ** BigInt(POWER_OF_18); // 1 ONE = 10^18 Wei
  const WEI_PER_CENT = WEI_PER_DOLLAR / BigInt(PRECENTAGE);
  return (BigInt(amountCents) * WEI_PER_CENT).toString();
}

/**
 * Creates a Stripe Connect Custom account for a user.
 * The account ID should be persisted to users.stripeConnectAccountId.
 *
 * Note: Custom accounts require agreeing to Stripe's terms on behalf of the
 * connected account. In production, ensure ToS acceptance is collected.
 */
export async function createConnectedAccount(email: string): Promise<string> {
  const account = await stripe.accounts.create({
    type: "custom",
    country: "US",
    email,
    capabilities: {
      transfers: { requested: true },
    },
  });
  return account.id;
}

/**
 * Adds a bank account as an external account on a Stripe connected account.
 * Returns the Stripe bank account ID (ba_...).
 * For each withdrawal a new bank account is added — reuse is not assumed.
 */
export async function addBankAccount(
  connectedAccountId: string,
  bankDetails: {
    routingNumber: string;
    accountNumber: string;
    accountHolderName: string;
    accountHolderType: "individual" | "company";
  }
): Promise<string> {
  const bankAccount = await stripe.accounts.createExternalAccount(
    connectedAccountId,
    {
      external_account: {
        object: "bank_account",
        country: "US",
        currency: "usd",
        routing_number: bankDetails.routingNumber,
        account_number: bankDetails.accountNumber,
        account_holder_name: bankDetails.accountHolderName,
        account_holder_type: bankDetails.accountHolderType,
      },
    }
  );
  return bankAccount.id;
}

/**
 * Transfers funds from the platform's Stripe balance to a connected account.
 * The idempotency key prevents duplicate transfers if the request is retried.
 */
export async function createTransfer(
  netAmountCents: number,
  connectedAccountId: string,
  idempotencyKey: string
): Promise<string> {
  const transfer = await stripe.transfers.create(
    {
      amount: netAmountCents,
      currency: "usd",
      destination: connectedAccountId,
    },
    { idempotencyKey }
  );
  return transfer.id;
}

/**
 * Initiates a payout from a connected account's Stripe balance to their bank.
 * Must be called after createTransfer funds the connected account.
 */
export async function createPayout(
  netAmountCents: number,
  connectedAccountId: string,
  idempotencyKey: string
): Promise<string> {
  const payout = await stripe.payouts.create(
    {
      amount: netAmountCents,
      currency: "usd",
    },
    {
      stripeAccount: connectedAccountId,
      idempotencyKey,
    }
  );
  return payout.id;
}
