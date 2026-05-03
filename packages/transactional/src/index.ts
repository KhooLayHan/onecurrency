import { renderAsync } from "@react-email/render";
import React from "react";
import { DepositFailedEmail } from "./emails/deposit-failed";
import { DepositSuccessEmail } from "./emails/deposit-success";
import { WithdrawalFailedEmail } from "./emails/withdrawal-failed";
import { WithdrawalInitiatedEmail } from "./emails/withdrawal-initiated";

export type { DepositFailedEmailProps } from "./emails/deposit-failed";
export type { DepositSuccessEmailProps } from "./emails/deposit-success";
export type { WithdrawalFailedEmailProps } from "./emails/withdrawal-failed";
export type { WithdrawalInitiatedEmailProps } from "./emails/withdrawal-initiated";

export async function renderDepositSuccess(
  props: React.ComponentProps<typeof DepositSuccessEmail>
): Promise<string> {
  return renderAsync(React.createElement(DepositSuccessEmail, props));
}

export async function renderDepositFailed(
  props: React.ComponentProps<typeof DepositFailedEmail>
): Promise<string> {
  return renderAsync(React.createElement(DepositFailedEmail, props));
}

export async function renderWithdrawalInitiated(
  props: React.ComponentProps<typeof WithdrawalInitiatedEmail>
): Promise<string> {
  return renderAsync(React.createElement(WithdrawalInitiatedEmail, props));
}

export async function renderWithdrawalFailed(
  props: React.ComponentProps<typeof WithdrawalFailedEmail>
): Promise<string> {
  return renderAsync(React.createElement(WithdrawalFailedEmail, props));
}
