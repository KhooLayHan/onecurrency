"use client";

import { useForm } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useConnection } from "wagmi";
import { KYC_STATUS } from "@/common/constants/kyc";
import { depositSchema } from "@/common/index";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserWallet } from "@/hooks/use-user-wallet";
import { orpcClient } from "@/lib/api";
import { useSession } from "@/lib/auth-client";

const CENTS_PER_DOLLAR = 100;

type SubmitButtonLabelProps = {
  isWalletLoading: boolean;
  isSubmitting: boolean;
};

function SubmitButtonLabel({
  isWalletLoading,
  isSubmitting,
}: SubmitButtonLabelProps) {
  if (isWalletLoading) {
    return (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading wallet...
      </>
    );
  }
  if (isSubmitting) {
    return "Generating Secure Link...";
  }
  return "Continue to Payment";
}

// async function initiateCheckout(
//   amountCents: number,
//   walletId: number
// ): Promise<string | null> {
//   const response = await ofetch(
//     `${env.NEXT_PUBLIC_API_URL}/api/v1/deposits/checkout`,
//     {
//       method: "POST",
//       body: { amountCents, walletId },
//       credentials: "include",
//     }
//   );
//   return response.success && response.checkoutUrl
//     ? (response.checkoutUrl as string)
//     : null;
// }

async function initiateCheckout(
  amountCents: number,
  walletId: string
): Promise<string | null> {
  const response = await orpcClient.deposits.checkout({
    amountCents,
    walletId,
  });
  return response.checkoutUrl ?? null;
}

export function DepositForm() {
  const { address } = useConnection();
  const [globalError, setGlobalError] = useState<string | null>(null);

  const { data: session } = useSession();
  const {
    walletId,
    isLoading: isWalletLoading,
    error: walletError,
  } = useUserWallet();

  // Check if user has completed KYC verification
  const isVerified = session?.user?.kycStatusId === KYC_STATUS.VERIFIED;

  const form = useForm({
    defaultValues: {
      amount: 100, // Default suggested amount
    },
    onSubmit: async ({ value }) => {
      setGlobalError(null);

      if (!address) {
        setGlobalError("Please connect your wallet first.");
        return;
      }

      if (!walletId) {
        setGlobalError("No primary wallet found. Please contact support.");
        return;
      }

      try {
        const amountCents = Math.round(value.amount * CENTS_PER_DOLLAR);
        const checkoutUrl = await initiateCheckout(amountCents, walletId);
        if (checkoutUrl) {
          window.location.href = checkoutUrl;
        }
      } catch (error) {
        if (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to initiate deposit. Please try again.";
          setGlobalError(message);
        }
      }
    },
  });

  return (
    <form
      className="space-y-6 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      {/* Wallet error */}
      {walletError && (
        <Alert variant="destructive">
          <AlertDescription>
            Unable to load your wallet:{" "}
            {walletError instanceof Error
              ? walletError.message
              : "Unknown error. Please try again."}
          </AlertDescription>
        </Alert>
      )}

      {/* TanStack Form Field */}
      <form.Field
        name="amount"
        validators={{
          onChange: depositSchema.shape.amount,
        }}
      >
        {(field) => (
          <div className="space-y-3">
            <Label className="text-muted-foreground" htmlFor={field.name}>
              Amount (USD)
            </Label>

            {/* Hero amount input — intentionally oversized for FinTech clarity */}
            <div className="relative flex items-center">
              <span className="absolute left-4 select-none font-semibold text-2xl text-muted-foreground">
                $
              </span>
              <Input
                className="h-16 rounded-xl border-2 pl-10 font-bold text-3xl"
                id={field.name}
                inputMode="decimal"
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(Number(e.target.value))}
                state={field.state.meta.errors.length > 0 ? "error" : "default"}
                type="number"
                value={field.state.value}
              />
            </div>

            {/* Field-level Error */}
            {field.state.meta.errors.length > 0 && (
              <p className="font-medium text-destructive text-sm">
                {field.state.meta.errors.join(", ")}
              </p>
            )}
          </div>
        )}
      </form.Field>

      {/* Global API Error */}
      {globalError && (
        <Alert variant="destructive">
          <AlertDescription>{globalError}</AlertDescription>
        </Alert>
      )}

      {/* Submit Button */}
      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting]}
      >
        {([canSubmit, isSubmitting]) => (
          <Button
            className="w-full rounded-xl"
            disabled={
              !canSubmit ||
              isSubmitting ||
              !address ||
              !isVerified ||
              isWalletLoading
            }
            size="lg"
            type="submit"
            variant="primary"
          >
            <SubmitButtonLabel
              isSubmitting={isSubmitting as boolean}
              isWalletLoading={isWalletLoading}
            />
          </Button>
        )}
      </form.Subscribe>

      <p className="mt-4 text-center text-muted-foreground text-xs">
        Secure checkout provided by{" "}
        <span className="font-semibold text-foreground">Stripe</span>
      </p>
    </form>
  );
}
