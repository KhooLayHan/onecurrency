import { render } from "@react-email/render";
import React from "react";
import { DepositFailedEmail } from "./deposit-failed";
import { DepositSuccessEmail } from "./deposit-success";
import { PasswordResetEmail } from "./password-reset";
import { WithdrawalFailedEmail } from "./withdrawal-failed";
import { WithdrawalInitiatedEmail } from "./withdrawal-initiated";

export type { DepositFailedEmailProps } from "./deposit-failed";
export type { DepositSuccessEmailProps } from "./deposit-success";
export type { PasswordResetEmailProps } from "./password-reset";
export type { WithdrawalFailedEmailProps } from "./withdrawal-failed";
export type { WithdrawalInitiatedEmailProps } from "./withdrawal-initiated";

export function renderPasswordReset(
  props: React.ComponentProps<typeof PasswordResetEmail>
): Promise<string> {
  return render(React.createElement(PasswordResetEmail, props));
}

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
