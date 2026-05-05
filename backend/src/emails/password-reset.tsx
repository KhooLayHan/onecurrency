/** @jsxImportSource react */
import { Button, Hr, Text } from "react-email";
import { EmailLayout } from "./layout";

export type PasswordResetEmailProps = {
  url: string;
};

const PASSWORD_RESET_EXPIRY_HOURS = 1;

export function PasswordResetEmail({ url }: PasswordResetEmailProps) {
  return (
    <EmailLayout preview="Reset your OneCurrency password">
      <Text className="m-0 mb-4 text-center text-4xl">🔒</Text>
      <Text className="m-0 mb-6 text-center font-semibold text-slate-700 text-sm uppercase tracking-wide">
        Password Reset
      </Text>
      <Hr className="my-6 border-slate-200" />
      <Text className="m-0 mb-2 text-base text-slate-900">Hi,</Text>
      <Text className="m-0 mb-2 text-base text-slate-700">
        We received a request to reset your OneCurrency password.
      </Text>
      <Text className="m-0 mb-6 text-base text-slate-700">
        Click the button below to set a new password. This link expires in{" "}
        {PASSWORD_RESET_EXPIRY_HOURS} hour.
      </Text>
      <Button
        className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-sm text-white no-underline"
        href={url}
      >
        Reset Password
      </Button>
      <Hr className="my-6 border-slate-200" />
      <Text className="m-0 text-slate-400 text-xs">
        If you did not request this, you can safely ignore this email.
      </Text>
    </EmailLayout>
  );
}
