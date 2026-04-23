"use client";

import { useForm } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";

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

import { ofetch } from "ofetch";
import { useState } from "react";
import { useConnection } from "wagmi";
import { KYC_STATUS } from "@/common/constants/kyc";
import { depositSchema } from "@/common/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { env } from "@/env";
import { useUserWallet } from "@/hooks/use-user-wallet";
import { useSession } from "@/lib/auth-client";

const CENTS_PER_DOLLAR = 100;

async function initiateCheckout(
  amountCents: number,
  walletId: number
): Promise<string | null> {
  const response = await ofetch(
    `${env.NEXT_PUBLIC_API_URL}/api/v1/deposits/checkout`,
    {
      method: "POST",
      body: { amountCents, walletId },
      credentials: "include",
    }
  );
  return response.success && response.checkoutUrl
    ? (response.checkoutUrl as string)
    : null;
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
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-destructive text-sm">
          Unable to load your wallet:{" "}
          {walletError instanceof Error
            ? walletError.message
            : "Unknown error. Please try again."}
        </div>
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

            {/* Massive FinTech Input Design */}
            <div className="relative flex items-center">
              <span className="absolute left-4 font-semibold text-2xl text-muted-foreground">
                $
              </span>
              <Input
                className="h-16 rounded-xl border-2 pl-10 font-bold text-3xl focus-visible:border-primary focus-visible:ring-primary"
                id={field.name}
                inputMode="decimal"
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(Number(e.target.value))}
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
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-destructive text-sm">
          {globalError}
        </div>
      )}

      {/* Submit Button */}
      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting]}
      >
        {([canSubmit, isSubmitting]) => (
          <Button
            className="h-12 w-full rounded-xl font-semibold text-base"
            disabled={
              !canSubmit ||
              isSubmitting ||
              !address ||
              !isVerified ||
              isWalletLoading
            }
            type="submit"
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
