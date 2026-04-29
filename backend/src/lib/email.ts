import { Resend } from "resend";
import { env } from "../env";
import { logger } from "./logger";

const resend = new Resend(env.RESEND_API_KEY);
const CENTS_PER_DOLLAR = 100;

const formatUsd = (cents: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / CENTS_PER_DOLLAR);

const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, "'")
    .replace(/'/g, "'");

export async function sendPasswordResetEmail(
  to: string,
  url: string
): Promise<void> {
  try {
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: [to],
      subject: "Reset your OneCurrency password",
      html: `
        <p>We received a request to reset your OneCurrency password.</p>
        <p><a href="${escapeHtml(url)}">Click here to reset your password</a></p>
        <p>This link expires in 1 hour. If you did not request this, you can safely ignore this email.</p>
      `,
    });
    if (error) {
      logger.warn({ error }, "Failed to send password reset email");
    }
  } catch (err) {
    logger.warn(
      { error: err },
      "Unexpected error sending password reset email"
    );
  }
}

export async function sendDepositReceivedEmail(
  to: string,
  name: string,
  amountCents: number,
  depositId: string
): Promise<void> {
  try {
    const { error } = await resend.emails.send(
      {
        from: env.EMAIL_FROM,
        to: [to],
        subject: "Money added to your account",
        html: `
          <p>Hi ${escapeHtml(name)},</p>
          <p>Your deposit of <strong>${formatUsd(amountCents)}</strong> has been added to your OneCurrency account and is ready to use.</p>
        `,
      },
      { idempotencyKey: `deposit-received/${depositId}` }
    );
    if (error) {
      logger.warn(
        { error, depositId },
        "Failed to send deposit notification email"
      );
    }
  } catch (err) {
    logger.warn(
      { error: err, depositId },
      "Unexpected error sending deposit notification email"
    );
  }
}

export async function sendWithdrawalProcessedEmail(
  to: string,
  name: string,
  amountCents: number,
  withdrawalId: string
): Promise<void> {
  try {
    const { error } = await resend.emails.send(
      {
        from: env.EMAIL_FROM,
        to: [to],
        subject: "Your withdrawal is being processed",
        html: `
          <p>Hi ${escapeHtml(name)},</p>
          <p>Your withdrawal of <strong>${formatUsd(amountCents)}</strong> is being processed and will arrive in your bank account within 1–3 business days.</p>
        `,
      },
      { idempotencyKey: `withdrawal-processed/${withdrawalId}` }
    );
    if (error) {
      logger.warn(
        { error, withdrawalId },
        "Failed to send withdrawal notification email"
      );
    }
  } catch (err) {
    logger.warn(
      { error: err, withdrawalId },
      "Unexpected error sending withdrawal notification email"
    );
  }
}

type SendTransferSentEmailOptions = {
  to: string;
  senderName: string;
  recipientName: string;
  amountCents: number;
  transferId: string;
};

export async function sendTransferSentEmail({
  to,
  senderName,
  recipientName,
  amountCents,
  transferId,
}: SendTransferSentEmailOptions): Promise<void> {
  try {
    const { error } = await resend.emails.send(
      {
        from: env.EMAIL_FROM,
        to: [to],
        subject: `You sent ${formatUsd(amountCents)}`,
        html: `
          <p>Hi ${escapeHtml(senderName)},</p>
          <p>You sent <strong>${formatUsd(amountCents)}</strong> to ${escapeHtml(recipientName)}. The transfer has completed.</p>
        `,
      },
      { idempotencyKey: `transfer-sent/${transferId}` }
    );
    if (error) {
      logger.warn({ error, transferId }, "Failed to send transfer sent email");
    }
  } catch (err) {
    logger.warn(
      { error: err, transferId },
      "Unexpected error sending transfer sent email"
    );
  }
}

type SendTransferReceivedEmailOptions = {
  to: string;
  recipientName: string;
  senderName: string;
  amountCents: number;
  transferId: string;
};

export async function sendTransferReceivedEmail({
  to,
  recipientName,
  senderName,
  amountCents,
  transferId,
}: SendTransferReceivedEmailOptions): Promise<void> {
  try {
    const { error } = await resend.emails.send(
      {
        from: env.EMAIL_FROM,
        to: [to],
        subject: `You received ${formatUsd(amountCents)}`,
        html: `
          <p>Hi ${escapeHtml(recipientName)},</p>
          <p><strong>${escapeHtml(senderName)}</strong> sent you <strong>${formatUsd(amountCents)}</strong>. The funds are now in your account.</p>
        `,
      },
      { idempotencyKey: `transfer-received/${transferId}` }
    );
    if (error) {
      logger.warn(
        { error, transferId },
        "Failed to send transfer received email"
      );
    }
  } catch (err) {
    logger.warn(
      { error: err, transferId },
      "Unexpected error sending transfer received email"
    );
  }
}
