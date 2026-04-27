"use client";

import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Send, UserCheck } from "lucide-react";
import { useCallback, useState } from "react";
import { KYC_STATUS } from "@/common/constants/kyc";
import {
  P2P_TRANSFER_MAX,
  P2P_TRANSFER_MIN,
  transferSchema,
} from "@/common/index";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { orpcClient } from "@/lib/api";
import { useSession } from "@/lib/auth-client";

const CENTS_PER_DOLLAR = 100;
const NOTE_MAX_LENGTH = 140;
const RECIPIENT_LOOKUP_DEBOUNCE_MS = 600;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / CENTS_PER_DOLLAR);
}

export function SendForm() {
  const { data: session } = useSession();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    transferId: string;
    recipientName: string;
    amountCents: number;
  } | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [debouncedEmail, setDebouncedEmail] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  const isVerified = session?.user?.kycStatusId === KYC_STATUS.VERIFIED;

  const {
    data: recipient,
    isLoading: isLookingUp,
    isError: recipientNotFound,
  } = useQuery({
    queryKey: ["find-recipient", debouncedEmail],
    queryFn: () => orpcClient.users.findRecipient({ email: debouncedEmail }),
    enabled: debouncedEmail.length > 0 && EMAIL_REGEX.test(debouncedEmail),
    retry: false,
  });

  const handleEmailChange = useCallback(
    (email: string) => {
      setRecipientEmail(email);
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      const timer = setTimeout(() => {
        setDebouncedEmail(email);
      }, RECIPIENT_LOOKUP_DEBOUNCE_MS);
      setDebounceTimer(timer);
    },
    [debounceTimer]
  );

  const form = useForm({
    defaultValues: {
      amount: 10,
      note: "",
    },
    onSubmit: async ({ value }) => {
      setGlobalError(null);
      const amountCents = Math.round(value.amount * CENTS_PER_DOLLAR);

      try {
        const result = await orpcClient.transfers.send({
          recipientEmail,
          amountCents,
          note: value.note || undefined,
          idempotencyKey: crypto.randomUUID(),
        });
        setSuccess({
          transferId: result.transferId,
          recipientName: result.recipientName,
          amountCents,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to send money. Please try again.";
        setGlobalError(message);
      }
    },
  });

  if (success) {
    return (
      <div className="space-y-4 py-8 text-center">
        <div className="flex justify-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-success-100 dark:bg-success-900/30">
            <CheckCircle2 className="size-8 text-success-600 dark:text-success-400" />
          </div>
        </div>
        <h2 className="font-semibold text-xl">Money sent</h2>
        <p className="text-muted-foreground text-sm">
          {formatUsd(success.amountCents)} was sent to{" "}
          <span className="font-medium text-foreground">
            {success.recipientName}
          </span>
          .
        </p>
        <p className="font-mono text-muted-foreground text-xs">
          Reference: {success.transferId}
        </p>
        <Button
          className="mt-4"
          onClick={() => {
            setSuccess(null);
            setRecipientEmail("");
            setDebouncedEmail("");
            form.reset();
          }}
          variant="outline"
        >
          Send again
        </Button>
      </div>
    );
  }

  const canSubmit =
    !!recipient &&
    !recipientNotFound &&
    !isLookingUp &&
    recipientEmail === debouncedEmail;

  return (
    <form
      className="space-y-6 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="recipient-email">Recipient email</Label>
        <div className="relative">
          <Input
            id="recipient-email"
            inputMode="email"
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder="friend@example.com"
            type="email"
            value={recipientEmail}
          />
          {isLookingUp && (
            <Loader2 className="-translate-y-1/2 absolute top-1/2 right-3 size-4 animate-spin text-muted-foreground" />
          )}
          {recipient && !isLookingUp && (
            <UserCheck className="-translate-y-1/2 absolute top-1/2 right-3 size-4 text-success-600 dark:text-success-400" />
          )}
        </div>
        {recipient && (
          <p className="text-sm text-success-600 dark:text-success-400">
            Sending to: <span className="font-medium">{recipient.name}</span>
          </p>
        )}
        {recipientNotFound && debouncedEmail.length > 0 && (
          <p className="text-destructive text-sm">
            No account found for this email.
          </p>
        )}
      </div>

      <form.Field
        name="amount"
        validators={{ onChange: transferSchema.shape.amount }}
      >
        {(field) => (
          <div className="space-y-2">
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
                max={P2P_TRANSFER_MAX}
                min={P2P_TRANSFER_MIN}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(Number(e.target.value))}
                state={field.state.meta.errors.length > 0 ? "error" : "default"}
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
          const cents = Math.round((amount || 0) * CENTS_PER_DOLLAR);
          return (
            <div className="space-y-2 rounded-lg bg-muted/50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Send amount</span>
                <span className="tabular-nums">{formatUsd(cents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Processing fee</span>
                <span className="text-success-600 tabular-nums dark:text-success-400">
                  Free
                </span>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between font-semibold">
                <span>Recipient receives</span>
                <span className="text-success-600 tabular-nums dark:text-success-400">
                  {formatUsd(cents)}
                </span>
              </div>
            </div>
          );
        }}
      </form.Subscribe>

      <form.Field name="note">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>
              Note{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              className="min-h-20"
              id={field.name}
              maxLength={NOTE_MAX_LENGTH}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="What's this for?"
              value={field.state.value}
            />
            <p className="text-right text-muted-foreground text-xs">
              {field.state.value.length}/{NOTE_MAX_LENGTH}
            </p>
          </div>
        )}
      </form.Field>

      {globalError && (
        <Alert variant="destructive">
          <AlertDescription>{globalError}</AlertDescription>
        </Alert>
      )}

      {!isVerified && (
        <Alert>
          <AlertDescription>
            Complete identity verification in your Profile before sending money.
          </AlertDescription>
        </Alert>
      )}

      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting]}
      >
        {([formCanSubmit, isSubmitting]) => (
          <Button
            className="w-full rounded-xl"
            disabled={
              !formCanSubmit || isSubmitting || !isVerified || !canSubmit
            }
            size="lg"
            type="submit"
            variant="primary"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Money
              </>
            )}
          </Button>
        )}
      </form.Subscribe>

      <p className="mt-4 text-center text-muted-foreground text-xs">
        Transfers are instant with no platform fees. The recipient's balance
        updates immediately.
      </p>
    </form>
  );
}
