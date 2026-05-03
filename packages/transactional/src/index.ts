import { render } from "@react-email/render";
import React from "react";
import { DepositFailedEmail } from "./emails/deposit-failed";
import { DepositSuccessEmail } from "./emails/deposit-success";
import { WithdrawalFailedEmail } from "./emails/withdrawal-failed";
import { WithdrawalInitiatedEmail } from "./emails/withdrawal-initiated";

export type { DepositFailedEmailProps } from "./emails/deposit-failed";
export type { DepositSuccessEmailProps } from "./emails/deposit-success";
export type { WithdrawalFailedEmailProps } from "./emails/withdrawal-failed";
export type { WithdrawalInitiatedEmailProps } from "./emails/withdrawal-initiated";

export function renderDepositSuccess(
  props: React.ComponentProps<typeof DepositSuccessEmail>
): Promise<string> {
  return render(React.createElement(DepositSuccessEmail, props));
}

export function renderDepositFailed(
  props: React.ComponentProps<typeof DepositFailedEmail>
): Promise<string> {
  return render(React.createElement(DepositFailedEmail, props));
}

export function renderWithdrawalInitiated(
  props: React.ComponentProps<typeof WithdrawalInitiatedEmail>
): Promise<string> {
  return render(React.createElement(WithdrawalInitiatedEmail, props));
}

export function renderWithdrawalFailed(
  props: React.ComponentProps<typeof WithdrawalFailedEmail>
): Promise<string> {
  return render(React.createElement(WithdrawalFailedEmail, props));
}
