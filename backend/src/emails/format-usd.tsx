export const CENTS_PER_DOLLAR = 100;

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / CENTS_PER_DOLLAR);
}
