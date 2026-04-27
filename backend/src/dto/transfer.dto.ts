import z from "zod";
import { P2P_TRANSFER_MAX, P2P_TRANSFER_MIN } from "@/common/index";

const CENTS_PER_DOLLAR = 100;
const TRANSFER_MIN_CENTS = P2P_TRANSFER_MIN * CENTS_PER_DOLLAR;
const TRANSFER_MAX_CENTS = P2P_TRANSFER_MAX * CENTS_PER_DOLLAR;
const NOTE_MAX_LENGTH = 140;

export const initiateTransferSchema = z.object({
  recipientEmail: z.string().email("Please enter a valid email address"),
  amountCents: z
    .number()
    .int()
    .min(TRANSFER_MIN_CENTS, `Minimum transfer is $${P2P_TRANSFER_MIN}.00`)
    .max(TRANSFER_MAX_CENTS, `Maximum transfer is $${P2P_TRANSFER_MAX}.00`),
  note: z.string().max(NOTE_MAX_LENGTH).optional(),
});

export type InitiateTransferRequest = z.infer<typeof initiateTransferSchema>;
