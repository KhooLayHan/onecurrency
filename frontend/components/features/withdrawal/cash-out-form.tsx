"use client";

import { useForm } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { KYC_STATUS } from "@/common/constants/kyc";
import { withdrawalSchema, WITHDRAWAL_FEE_PERCENT } from "@/common/index";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { orpcClient } from "@/lib/api";
import { useSession } from "@/lib/auth-client";

const CENTS_PER_DOLLAR = 100;
const PERCENTAGE_CONVERSION_FACTOR = 100;
const FEE_DISPLAY_PERCENT =
  WITHDRAWAL_FEE_PERCENT * PERCENTAGE_CONVERSION_FACTOR;

type SuccessState = {
  withdrawalId: string;
  netAmountDollars: number;
};

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / CENTS_PER_DOLLAR);
}

export function CashOutForm() {
  const { data: session } = useSession();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);

  const isVerified = session?.user?.kycStatusId === KYC_STATUS.VERIFIED;

  const form = useForm({
    defaultValues: {
      amount: 100,
      bankAccountHolderName: "",
      bankAccountHolderType: "individual" as "individual" | "company",
      bankRoutingNumber: "",
      bankAccountNumber: "",
    },
    onSubmit: async ({ value }) => {
      setGlobalError(null);
      const amountCents = Math.round(value.amount * CENTS_PER_DOLLAR);
      const feeCents = Math.floor(amountCents * WITHDRAWAL_FEE_PERCENT);
      const netAmountCents = amountCents - feeCents;

      try {
        const result = await orpcClient.withdrawals.initiate({
          amountCents,
          bankAccountHolderName: value.bankAccountHolderName,
          bankAccountHolderType: value.bankAccountHolderType,
          bankRoutingNumber: value.bankRoutingNumber,
          bankAccountNumber: value.bankAccountNumber,
        });
        setSuccess({
          withdrawalId: result.withdrawalId,
          netAmountDollars: netAmountCents / CENTS_PER_DOLLAR,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to initiate cash-out. Please try again.";
        setGlobalError(message);
      }
    },
  });

  if (success) {
    return (
      <div className="space-y-4 py-8 text-center">
        <div className="flex justify-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-success-100 dark:bg-success-900/30">
            <span className="text-2xl text-success-600 dark:text-success-400">
              ✓
            </span>
          </div>
        </div>
        <h2 className="font-semibold text-xl">Cash-out submitted</h2>
        <p className="text-muted-foreground text-sm">
          {formatUsd(success.netAmountDollars * CENTS_PER_DOLLAR)} will arrive
          in your bank account within 2–5 business days.
        </p>
        <p className="font-mono text-muted-foreground text-xs">
          Reference: {success.withdrawalId}
        </p>
        <Button
          className="mt-4"
          onClick={() => {
            setSuccess(null);
            form.reset();
          }}
          variant="outline"
        >
          Make another cash-out
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-6 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <form.Field
        name="amount"
        validators={{ onChange: withdrawalSchema.shape.amount }}
      >
        {(field) => (
          <div className="space-y-3">
            <Label className="text-muted-foreground" htmlFor={field.name}>
              Amount (USD)
            </Label>
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
                state={
                  field.state.meta.errors.length > 0 ? "error" : "default"
                }
                type="number"
                value={field.state.value}
              />
            </div>
            {field.state.meta.errors.length > 0 && (
              <p className="font-medium text-destructive text-sm">
                {field.state.meta.errors.join(", ")}
              </p>
            )}
          </div>
        )}
      </form.Field>

      <form.Subscribe selector={(s) => s.values.amount}>
        {(amount) => {
          const grossCents = Math.round((amount || 0) * CENTS_PER_DOLLAR);
          const feeCents = Math.floor(grossCents * WITHDRAWAL_FEE_PERCENT);
          const netCents = grossCents - feeCents;
          return (
            <div className="space-y-2 rounded-lg bg-muted/50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cash-out amount</span>
                <span className="tabular-nums">{formatUsd(grossCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Processing fee ({FEE_DISPLAY_PERCENT}%)
                </span>
                <span className="text-muted-foreground tabular-nums">
                  -{formatUsd(feeCents)}
                </span>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between font-semibold">
                <span>You receive</span>
                <span className="text-success-600 tabular-nums dark:text-success-400">
                  {formatUsd(netCents)}
                </span>
              </div>
            </div>
          );
        }}
      </form.Subscribe>

      <Separator />

      <div className="space-y-4">
        <p className="font-medium text-sm">Bank Account Details</p>

        <form.Field name="bankAccountHolderName">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>Account holder name</Label>
              <Input
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Jane Smith"
                value={field.state.value}
              />
            </div>
          )}
        </form.Field>

        <form.Field name="bankRoutingNumber">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>Routing number</Label>
              <Input
                id={field.name}
                inputMode="numeric"
                maxLength={9}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="9 digits"
                value={field.state.value}
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-destructive text-xs">
                  {field.state.meta.errors.join(", ")}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="bankAccountNumber">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>Account number</Label>
              <Input
                id={field.name}
                inputMode="numeric"
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="4–17 digits"
                value={field.state.value}
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-destructive text-xs">
                  {field.state.meta.errors.join(", ")}
                </p>
              )}
            </div>
          )}
        </form.Field>
      </div>

      {globalError && (
        <Alert variant="destructive">
          <AlertDescription>{globalError}</AlertDescription>
        </Alert>
      )}

      {!isVerified && (
        <Alert>
          <AlertDescription>
            Complete identity verification in your Profile before cashing out.
          </AlertDescription>
        </Alert>
      )}

      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting]}
      >
        {([canSubmit, isSubmitting]) => (
          <Button
            className="w-full rounded-xl"
            disabled={!canSubmit || isSubmitting || !isVerified}
            size="lg"
            type="submit"
            variant="primary"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Cash Out"
            )}
          </Button>
        )}
      </form.Subscribe>

      <p className="mt-4 text-center text-muted-foreground text-xs">
        Payouts take 2–5 business days. Tokens are burned immediately on
        submission.
      </p>
    </form>
  );
}
