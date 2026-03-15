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
  const BASE_MULTIPLIER = 100;
  const WEI_MULTIPLER = 1e18;

  const dollars = amountCents / BASE_MULTIPLIER;
  return BigInt(dollars * WEI_MULTIPLER).toString(); // Multiply by 10^18 for exact Wei amount
}
