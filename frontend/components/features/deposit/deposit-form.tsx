"use client";

import { useForm } from "@tanstack/react-form";
import { ofetch } from "ofetch";
import { useState } from "react";
import { useConnection } from "wagmi";
import { depositSchema } from "@/common/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { env } from "@/env";

export function DepositForm() {
  const { address } = useConnection();
  const [globalError, setGlobalError] = useState<string | null>(null);

  // 2. Initialize TanStack Form
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

      const TEMP_100 = 100;

      try {
        // Convert USD dollars to cents for the backend
        const amountCents = Math.round(value.amount * TEMP_100);

        // 3. Call the Hono Backend API
        const response = await ofetch(
          `${env.NEXT_PUBLIC_API_URL}/api/deposits/checkout`,
          {
            method: "POST",
            // Note: In a full production app, you'd fetch the user's DB walletId first.
            // For this MVP, we use walletId: 1 (the one we seeded earlier) to keep the flow fast.
            body: { amountCents, walletId: 1 },
          }
        );

        // 4. Redirect to Stripe Checkout!
        if (response.success && response.checkoutUrl) {
          window.location.href = response.checkoutUrl;
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
            disabled={!canSubmit || isSubmitting || !address}
            type="submit"
          >
            {isSubmitting ? "Generating Secure Link..." : "Continue to Payment"}
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
