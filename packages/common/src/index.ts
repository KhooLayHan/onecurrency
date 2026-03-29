import { z } from "zod";

export const hexString32Schema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

export const ethereumAddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

export const chainIdSchema = z.enum(["31337", "11155111"]);

export const AMOUNT_CENTS = 1000;
export const DEPOSIT_MAX = 10_000;

export const depositSchema = z.object({
  amount: z
    .number()
    .min(10, "Minimum deposit is $10.00")
    .max(DEPOSIT_MAX, "Maximum is $10,000.00"),
});
