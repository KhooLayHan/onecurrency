/** @jsxImportSource react */
import { Button, Hr, Preview, Text } from "react-email";
import { formatUsd } from "./format-usd";
import { EmailLayout } from "./layout";

export type WithdrawalFailedEmailProps = {
  name: string;
  amountCents: number;
  withdrawalId: string;
  dashboardUrl: string;
};

export function WithdrawalFailedEmail({
  name,
  amountCents,
  withdrawalId,
  dashboardUrl,
}: WithdrawalFailedEmailProps) {
  return (
    <EmailLayout
      preview={`There was a problem with your ${formatUsd(amountCents)} cash out`}
    >
      <Preview>{`There was a problem with your ${formatUsd(amountCents)} cash out`}</Preview>
      <Text className="m-0 mb-4 text-center text-4xl">✕</Text>
      <Text className="m-0 mb-6 text-center font-semibold text-red-500 text-sm uppercase tracking-wide">
        Cash Out Failed
      </Text>
      <Text className="m-0 mb-2 text-center font-bold text-4xl text-slate-900 tabular-nums">
        {formatUsd(amountCents)}
      </Text>
      <Text className="m-0 mb-8 text-center text-slate-500 text-sm">
        Was not sent to your bank account
      </Text>
      <Hr className="my-6 border-slate-200" />
      <Text className="m-0 mb-2 text-base text-slate-900">Hi {name},</Text>
      <Text className="m-0 mb-2 text-base text-slate-700">
        We encountered a problem processing your cash out. Your account balance
        has not been affected.
      </Text>
      <Text className="m-0 mb-6 text-base text-slate-700">
        Please try again from your account, or contact our support team if you
        need assistance.
      </Text>
      <Button
        className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-sm text-white no-underline"
        href={dashboardUrl}
      >
        View Account
      </Button>
      <Hr className="my-6 border-slate-200" />
      <Text className="m-0 text-slate-400 text-xs">
        Receipt reference: {withdrawalId}
      </Text>
    </EmailLayout>
  );
}
