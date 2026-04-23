import z from "zod";
import {
  AMOUNT_CENTS,
  DEPOSIT_MAX,
  ethereumAddressSchema,
  hexString32Schema,
} from "@/common/index";

/**
 * Request schemas and response types for deposit-related endpoints.
 */

/** Conversion factor: 100 cents = 1 dollar */
const CENTS_PER_DOLLAR = 100;

// --- Request DTOs ---

const DEPOSIT_MAX_CENTS = DEPOSIT_MAX * CENTS_PER_DOLLAR;

export const createCheckoutSchema = z.object({
  amountCents: z
    .number()
    .int()
    .min(
      AMOUNT_CENTS,
      `Minimum deposit is $${AMOUNT_CENTS / CENTS_PER_DOLLAR}.00`
    )
    .max(
      DEPOSIT_MAX_CENTS,
      `Maximum deposit is $${DEPOSIT_MAX / CENTS_PER_DOLLAR}.00`
    ),
  walletId: z.number().int().positive("Wallet ID must be positive"),
});

export type CreateCheckoutRequest = z.infer<typeof createCheckoutSchema>;

export const testMintRequestSchema = z.object({
  address: ethereumAddressSchema,
  amountWei: hexString32Schema,
});

export type TestMintRequest = z.infer<typeof testMintRequestSchema>;

// --- Metadata Types ---

export type StripeCheckoutMetadata = {
  userId: string;
  walletId: string;
};

// --- Response DTOs ---

export type CheckoutResponse = {
  checkoutUrl: string;
};

export type MintTestResponse = {
  txHash: string;
};
