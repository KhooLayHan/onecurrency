import { Button, Hr, Preview, Text } from "react-email";
import { EmailLayout } from "./layout";

export type DepositFailedEmailProps = {
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

export function DepositFailedEmail({
  name,
  amountCents,
  depositId,
  dashboardUrl,
}: DepositFailedEmailProps) {
  return (
    <EmailLayout
      preview={`We couldn't add ${formatUsd(amountCents)} to your account`}
    >
      <Preview>{`There was a problem adding ${formatUsd(amountCents)} to your OneCurrency account`}</Preview>

      {/* Status indicator */}
      <Text className="m-0 mb-4 text-center text-4xl">✕</Text>
      <Text className="m-0 mb-6 text-center font-semibold text-red-500 text-sm uppercase tracking-wide">
        Add Money Failed
      </Text>

      {/* Amount */}
      <Text className="m-0 mb-2 text-center font-bold text-4xl text-slate-900 tabular-nums">
        {formatUsd(amountCents)}
      </Text>
      <Text className="m-0 mb-8 text-center text-slate-500 text-sm">
        Was not added to your account
      </Text>

      <Hr className="my-6 border-slate-200" />

      {/* Message */}
      <Text className="m-0 mb-2 text-base text-slate-900">Hi {name},</Text>
      <Text className="m-0 mb-2 text-base text-slate-700">
        Your payment was charged, but we encountered a problem crediting your
        account. Your balance has not been updated.
      </Text>
      <Text className="m-0 mb-6 text-base text-slate-700">
        Please contact our support team at{" "}
        <a href="mailto:support@onecurrency.tech">support@onecurrency.tech</a>{" "}
        for assistance or to request a refund.
      </Text>

      {/* CTA */}
      <Button
        className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-sm text-white no-underline"
        href={dashboardUrl}
      >
        Try Again
      </Button>

      <Hr className="my-6 border-slate-200" />

      {/* Reference */}
      <Text className="m-0 text-slate-400 text-xs">
        Receipt reference: {depositId}
      </Text>
    </EmailLayout>
  );
}

export default DepositFailedEmail;
