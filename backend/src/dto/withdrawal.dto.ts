import z from "zod";
import { WITHDRAWAL_MAX, WITHDRAWAL_MIN } from "@/common/index";

const CENTS_PER_DOLLAR = 100;
const WITHDRAWAL_MIN_CENTS = WITHDRAWAL_MIN * CENTS_PER_DOLLAR;
const WITHDRAWAL_MAX_CENTS = WITHDRAWAL_MAX * CENTS_PER_DOLLAR;
const ACCOUNT_HOLDER_NAME_MAX_LENGTH = 100;
const BANK_ACCOUNT_NUMBER_MIN_LENGTH = 4;
const BANK_ACCOUNT_NUMBER_MAX_LENGTH = 17;
const ROUTING_NUMBER_LENGTH = 9;

export const initiateWithdrawalSchema = z.object({
  amountCents: z
    .number()
    .int()
    .min(WITHDRAWAL_MIN_CENTS, `Minimum cash-out is $${WITHDRAWAL_MIN}.00`)
    .max(WITHDRAWAL_MAX_CENTS, `Maximum cash-out is $${WITHDRAWAL_MAX}.00`),
  bankAccountHolderName: z
    .string()
    .min(1, "Account holder name is required")
    .max(ACCOUNT_HOLDER_NAME_MAX_LENGTH, "Account holder name too long"),
  bankAccountHolderType: z
    .enum(["individual", "company"])
    .default("individual"),
  bankRoutingNumber: z
    .string()
    .regex(
      new RegExp(`^\\d{${ROUTING_NUMBER_LENGTH}}$`),
      `Routing number must be exactly ${ROUTING_NUMBER_LENGTH} digits`
    ),
  bankAccountNumber: z
    .string()
    .min(
      BANK_ACCOUNT_NUMBER_MIN_LENGTH,
      `Account number must be at least ${BANK_ACCOUNT_NUMBER_MIN_LENGTH} digits`
    )
    .max(
      BANK_ACCOUNT_NUMBER_MAX_LENGTH,
      `Account number must be at most ${BANK_ACCOUNT_NUMBER_MAX_LENGTH} digits`
    )
    .regex(/^\d+$/, "Account number must contain only digits"),
});

export type InitiateWithdrawalRequest = z.infer<
  typeof initiateWithdrawalSchema
>;
