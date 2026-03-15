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
