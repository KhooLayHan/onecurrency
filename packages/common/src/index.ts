import { z } from "zod";

export const hexString32Schema = z
  .string()
  .regex(/^\d+$/, "Amount must be a numeric string");

// 2^256 - 1 (max uint256 value)
const UINT256_MAX = BigInt(
  "115792089237316195423570985008687907853269984665640564039457584007913129639935"
);

export const amountWeiSchema = z
  .string()
  .regex(/^[1-9]\d*$|^0$/, "Amount must be a non-negative decimal string")
  .refine((v) => BigInt(v) <= UINT256_MAX, {
    message: "Amount exceeds uint256 max",
  });

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
