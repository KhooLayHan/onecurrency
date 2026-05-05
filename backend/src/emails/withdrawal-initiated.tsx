/** @jsxImportSource react */
import { Button, Hr, Preview, Text } from "react-email";
import { formatUsd } from "./format-usd";
import { EmailLayout } from "./layout";

export type WithdrawalInitiatedEmailProps = {
  name: string;
  amountCents: number;
  withdrawalId: string;
  dashboardUrl: string;
};

const PAYOUT_BUSINESS_DAYS_MIN = 1;
const PAYOUT_BUSINESS_DAYS_MAX = 3;

export function WithdrawalInitiatedEmail({
  name,
  amountCents,
  withdrawalId,
  dashboardUrl,
}: WithdrawalInitiatedEmailProps) {
  return (
    <EmailLayout
      preview={`Your cash out of ${formatUsd(amountCents)} is on its way`}
    >
      <Preview>{`Your ${formatUsd(amountCents)} cash out is being processed`}</Preview>
      <Text className="m-0 mb-4 text-center text-4xl">⟳</Text>
      <Text className="m-0 mb-6 text-center font-semibold text-blue-600 text-sm uppercase tracking-wide">
        Cash Out Processing
      </Text>
      <Text className="m-0 mb-2 text-center font-bold text-4xl text-slate-900 tabular-nums">
        {formatUsd(amountCents)}
      </Text>
      <Text className="m-0 mb-8 text-center text-slate-500 text-sm">
        On its way to your bank account
      </Text>
      <Hr className="my-6 border-slate-200" />
      <Text className="m-0 mb-2 text-base text-slate-900">Hi {name},</Text>
      <Text className="m-0 mb-2 text-base text-slate-700">
        Your cash out is being processed. Funds typically arrive within{" "}
        {PAYOUT_BUSINESS_DAYS_MIN}–{PAYOUT_BUSINESS_DAYS_MAX} business days
        depending on your bank.
      </Text>
      <Text className="m-0 mb-6 text-base text-slate-700">
        You can track the status of your cash out from your account at any time.
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
