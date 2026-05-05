import { Resend } from "resend";
import {
  renderDepositFailed,
  renderDepositSuccess,
  renderWithdrawalFailed,
  renderWithdrawalInitiated,
} from "../emails";
import { env } from "../env";
import { logger } from "./logger";

const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const resend = new Resend(env.RESEND_API_KEY);

const DASHBOARD_URL =
  env.NODE_ENV === "development" || env.NODE_ENV === "testing"
    ? env.LOCAL_CORS_ORIGIN
    : env.PROD_CORS_ORIGIN;

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
        <p><a href="${url}">Click here to reset your password</a></p>
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
    const html = await renderDepositSuccess({
      name,
      amountCents,
      depositId,
      dashboardUrl: DASHBOARD_URL,
    });
    const { error } = await resend.emails.send(
      {
        from: env.EMAIL_FROM,
        to: [to],
        subject: "Money added to your account",
        html,
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

export async function sendDepositFailedEmail(
  to: string,
  name: string,
  amountCents: number,
  depositId: string
): Promise<void> {
  try {
    const html = await renderDepositFailed({
      name,
      amountCents,
      depositId,
      dashboardUrl: DASHBOARD_URL,
    });
    const { error } = await resend.emails.send(
      {
        from: env.EMAIL_FROM,
        to: [to],
        subject: "We couldn't add money to your account",
        html,
      },
      { idempotencyKey: `deposit-failed/${depositId}` }
    );
    if (error) {
      logger.warn({ error, depositId }, "Failed to send deposit failure email");
    }
  } catch (err) {
    logger.warn(
      { error: err, depositId },
      "Unexpected error sending deposit failure email"
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
    const html = await renderWithdrawalInitiated({
      name,
      amountCents,
      withdrawalId,
      dashboardUrl: DASHBOARD_URL,
    });
    const { error } = await resend.emails.send(
      {
        from: env.EMAIL_FROM,
        to: [to],
        subject: "Your cash out is being processed",
        html,
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

export async function sendWithdrawalFailedEmail(
  to: string,
  name: string,
  amountCents: number,
  withdrawalId: string
): Promise<void> {
  try {
    const html = await renderWithdrawalFailed({
      name,
      amountCents,
      withdrawalId,
      dashboardUrl: DASHBOARD_URL,
    });
    const { error } = await resend.emails.send(
      {
        from: env.EMAIL_FROM,
        to: [to],
        subject: "There was a problem with your cash out",
        html,
      },
      { idempotencyKey: `withdrawal-failed/${withdrawalId}` }
    );
    if (error) {
      logger.warn(
        { error, withdrawalId },
        "Failed to send withdrawal failure email"
      );
    }
  } catch (err) {
    logger.warn(
      { error: err, withdrawalId },
      "Unexpected error sending withdrawal failure email"
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
  const CENTS_PER_DOLLAR = 100;
  const formatUsd = (cents: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / CENTS_PER_DOLLAR);
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
  const CENTS_PER_DOLLAR = 100;
  const formatUsd = (cents: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / CENTS_PER_DOLLAR);
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
