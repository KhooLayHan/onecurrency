/** @jsxImportSource react */
import { Button, Hr, Preview, Text } from "react-email";
import { EmailLayout } from "./layout";

export type DepositSuccessEmailProps = {
  name: string;
  amountCents: number;
  depositId: string;
  dashboardUrl: string;
};

const CENTS_PER_DOLLAR = 100;

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / CENTS_PER_DOLLAR);
}

export function DepositSuccessEmail({
  name,
  amountCents,
  depositId,
  dashboardUrl,
}: DepositSuccessEmailProps) {
  return (
    <EmailLayout preview={`${formatUsd(amountCents)} added to your account`}>
      <Preview>{`${formatUsd(amountCents)} added to your OneCurrency account`}</Preview>
      <Text className="m-0 mb-4 text-center text-4xl">✓</Text>
      <Text className="m-0 mb-6 text-center font-semibold text-emerald-600 text-sm uppercase tracking-wide">
        Money Added
      </Text>
      <Text className="m-0 mb-2 text-center font-bold text-4xl text-slate-900 tabular-nums">
        {formatUsd(amountCents)}
      </Text>
      <Text className="m-0 mb-8 text-center text-slate-500 text-sm">
        Added to your account balance
      </Text>
      <Hr className="my-6 border-slate-200" />
      <Text className="m-0 mb-2 text-base text-slate-900">Hi {name},</Text>
      <Text className="m-0 mb-6 text-base text-slate-700">
        Your funds are ready to use. You can send money, check your balance, or
        review your transaction history from your account.
      </Text>
      <Button
        className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-sm text-white no-underline"
        href={dashboardUrl}
      >
        View Account
      </Button>
      <Hr className="my-6 border-slate-200" />
      <Text className="m-0 text-slate-400 text-xs">
        Receipt reference: {depositId}
      </Text>
    </EmailLayout>
  );
}
