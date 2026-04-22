"use client";

import { ArrowRight, Clock, Info, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

// Fee percentage for transfers
const TRANSFER_FEE_PERCENT = 0.5;

export default function TransferPage() {
  return (
    <div className="fade-in mx-auto flex w-full max-w-2xl animate-in flex-col gap-6 duration-300 ease-out">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Send Money</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Transfer funds to another account or cash out to your bank.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="size-5 text-primary" />
            Transfer Details
          </CardTitle>
          <CardDescription>
            Enter the recipient and amount to send.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="recipient">Recipient</FieldLabel>
              <Input
                className="bg-muted/50"
                disabled
                id="recipient"
                placeholder="Email, phone, or account ID"
              />
              <FieldDescription>
                Enter the recipient&apos;s email address or account ID.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="amount">Amount (USD)</FieldLabel>
              <div className="relative">
                <span className="-translate-y-1/2 absolute top-1/2 left-3 font-medium text-muted-foreground">
                  $
                </span>
                <Input
                  className="bg-muted/50 pl-7"
                  disabled
                  id="amount"
                  placeholder="0.00"
                  type="number"
                />
              </div>
              <FieldDescription>
                Minimum transfer amount is $1.00.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="note">Note (optional)</FieldLabel>
              <Input
                className="bg-muted/50"
                disabled
                id="note"
                placeholder="What's this for?"
              />
            </Field>
          </FieldGroup>

          <Separator />

          {/* Fee Information */}
          <div className="space-y-2 rounded-lg bg-muted/50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Transfer amount</span>
              <span className="font-medium tabular-nums">$0.00</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                Processing fee ({TRANSFER_FEE_PERCENT}%)
                <Info className="size-3" />
              </span>
              <span className="font-medium tabular-nums">$0.00</span>
            </div>
            <Separator className="my-2" />
            <div className="flex items-center justify-between">
              <span className="font-medium">Total</span>
              <span className="font-semibold tabular-nums">$0.00</span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button className="w-full gap-2" disabled>
            <ArrowRight className="size-4" />
            Continue
          </Button>

          {/* Coming Soon Notice */}
          <div className="flex items-center gap-2 rounded-lg border border-highlight-500/30 bg-highlight-50/50 p-3 text-highlight-700 dark:border-highlight-500/20 dark:bg-highlight-950/30 dark:text-highlight-300">
            <Clock className="size-4 shrink-0" />
            <p className="text-sm">
              Transfers are coming soon. Check back for updates.
            </p>
          </div>
        </CardFooter>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-dashed opacity-60">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <Send className="size-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-medium text-sm">Send to Contact</h3>
              <p className="text-muted-foreground text-xs">Coming soon</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed opacity-60">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <ArrowRight className="size-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-medium text-sm">Cash Out to Bank</h3>
              <p className="text-muted-foreground text-xs">Coming soon</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
