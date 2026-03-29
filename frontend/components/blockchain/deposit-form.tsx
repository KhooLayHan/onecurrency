"use client";

import { useForm } from "@tanstack/react-form";
import { ofetch } from "ofetch";
import { useConnection } from "wagmi";
import { depositSchema } from "@/common/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { env } from "@/env";

export function DepositForm() {
  const { address } = useConnection();

  const form = useForm({
    defaultValues: {
      amount: 100,
    },
    onSubmit: async ({ value }) => {
      if (!address) {
        // alert("Please connect your wallet first!");
        return;
      }

      try {
        const TO_CENTS = 100;

        const amountCents = value.amount * TO_CENTS;

        const response = await ofetch(
          `${env.NEXT_PUBLIC_API_URL}/api/deposits/checkout`,
          {
            method: "POST",
            body: {
              amountCents,
              walletId: 1, // NOTE: We will fetch the real Wallet ID from the DB in a later step
            },
          }
        );

        if (response.checkoutUrl) {
          window.location.href = response.checkoutUrl;
        }
      } catch (_error) {
        // .error("Deposit failed:", error);
        // alert("Failed to initiate deposit.");
      }
    },
  });

  return (
    <div className="mx-auto mt-10 max-w-md rounded-xl border bg-card p-6 shadow-sm">
      <h2 className="mb-4 font-bold text-2xl text-primary">Deposit Funds</h2>

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <form.Field
          name="amount"
          validators={{
            onChange: depositSchema.shape.amount,
          }}
        >
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Amount (USD)</Label>
              <div className="relative">
                <span className="absolute top-2.5 left-3 text-muted-foreground">
                  $
                </span>
                <Input
                  className="pl-8"
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(Number(e.target.value))}
                  type="number"
                  value={field.state.value}
                />
              </div>
              {field.state.meta.errors ? (
                <p className="mt-1 text-destructive text-sm">
                  {field.state.meta.errors.join(", ")}
                </p>
              ) : null}
            </div>
          )}
        </form.Field>
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              className="w-full"
              disabled={!canSubmit || isSubmitting || !address}
              type="submit"
            >
              {isSubmitting ? "Processing..." : "Proceed to Stripe"}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
