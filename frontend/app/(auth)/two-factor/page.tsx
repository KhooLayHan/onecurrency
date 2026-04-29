"use client";

import { useForm } from "@tanstack/react-form";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

const TOTP_CODE_LENGTH = 6;
const BACKUP_CODE_LENGTH = 8;

const totpSchema = z.object({
  code: z
    .string()
    .length(TOTP_CODE_LENGTH, "Enter your 6-digit code")
    .regex(/^\d+$/, "Code must be numbers only"),
  trustDevice: z.boolean(),
});

const backupSchema = z.object({
  code: z.string().min(1, "Enter a backup code"),
  trustDevice: z.boolean(),
});

type Mode = "totp" | "backup";

export default function TwoFactorPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("totp");

  const DEFAULT_REDIRECT = "/dashboard";

  const handleSuccess = () => {
    toast.success("Signed in successfully");
    router.push(DEFAULT_REDIRECT);
    router.refresh();
  };

  const totpForm = useForm({
    defaultValues: { code: "", trustDevice: false },
    validators: { onSubmit: totpSchema },
    onSubmit: async ({ value }) => {
      const result = await authClient.twoFactor.verifyTotp({
        code: value.code,
        trustDevice: value.trustDevice,
      });
      if (result.error) {
        toast.error(result.error.message || "Invalid code. Please try again.");
        return;
      }
      handleSuccess();
    },
  });

  const backupForm = useForm({
    defaultValues: { code: "", trustDevice: false },
    validators: { onSubmit: backupSchema },
    onSubmit: async ({ value }) => {
      const result = await authClient.twoFactor.verifyBackupCode({
        code: value.code,
        trustDevice: value.trustDevice,
      });
      if (result.error) {
        toast.error(
          result.error.message || "Invalid backup code. Please try again."
        );
        return;
      }
      handleSuccess();
    },
  });

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 sm:py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary shadow-sm">
            <span className="font-bold text-2xl text-primary-foreground">
              1
            </span>
          </div>
          <div className="text-center">
            <h1 className="font-bold text-2xl tracking-tight">OneCurrency</h1>
            <p className="mt-1 text-muted-foreground text-sm">
              Two-factor verification
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {mode === "totp" ? (
                <ShieldCheck className="size-5 text-primary" />
              ) : (
                <KeyRound className="size-5 text-primary" />
              )}
              {mode === "totp" ? "Authenticator code" : "Backup code"}
            </CardTitle>
            <CardDescription>
              {mode === "totp"
                ? "Enter the 6-digit code from your authenticator app."
                : "Enter one of your saved backup codes."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === "totp" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  totpForm.handleSubmit();
                }}
              >
                <FieldGroup>
                  <totpForm.Field name="code">
                    {(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>Code</FieldLabel>
                          <Input
                            aria-invalid={isInvalid}
                            autoComplete="one-time-code"
                            autoFocus
                            id={field.name}
                            inputMode="numeric"
                            maxLength={TOTP_CODE_LENGTH}
                            name={field.name}
                            onBlur={field.handleBlur}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "");
                              field.handleChange(val);
                              // Auto-submit when complete
                              if (val.length === TOTP_CODE_LENGTH) {
                                totpForm.handleSubmit();
                              }
                            }}
                            placeholder="000000"
                            type="text"
                            value={field.state.value}
                          />
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      );
                    }}
                  </totpForm.Field>

                  <totpForm.Field name="trustDevice">
                    {(field) => (
                      <Field orientation="horizontal">
                        <Checkbox
                          checked={field.state.value}
                          id={field.name}
                          onCheckedChange={(checked) =>
                            field.handleChange(checked === true)
                          }
                        />
                        <FieldContent>
                          <FieldLabel
                            className="font-normal text-muted-foreground text-sm"
                            htmlFor={field.name}
                          >
                            Trust this device for 30 days
                          </FieldLabel>
                        </FieldContent>
                      </Field>
                    )}
                  </totpForm.Field>
                </FieldGroup>

                <totpForm.Subscribe selector={(s) => s.isSubmitting}>
                  {(isSubmitting) => (
                    <Button
                      className="mt-6 w-full"
                      disabled={isSubmitting}
                      size="lg"
                      type="submit"
                    >
                      {isSubmitting ? "Verifying..." : "Verify"}
                    </Button>
                  )}
                </totpForm.Subscribe>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  backupForm.handleSubmit();
                }}
              >
                <FieldGroup>
                  <backupForm.Field name="code">
                    {(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>
                            Backup code
                          </FieldLabel>
                          <Input
                            aria-invalid={isInvalid}
                            autoFocus
                            id={field.name}
                            maxLength={BACKUP_CODE_LENGTH}
                            name={field.name}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="xxxxxxxx"
                            type="text"
                            value={field.state.value}
                          />
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      );
                    }}
                  </backupForm.Field>

                  <backupForm.Field name="trustDevice">
                    {(field) => (
                      <Field orientation="horizontal">
                        <Checkbox
                          checked={field.state.value}
                          id={field.name}
                          onCheckedChange={(checked) =>
                            field.handleChange(checked === true)
                          }
                        />
                        <FieldContent>
                          <FieldLabel
                            className="font-normal text-muted-foreground text-sm"
                            htmlFor={field.name}
                          >
                            Trust this device for 30 days
                          </FieldLabel>
                        </FieldContent>
                      </Field>
                    )}
                  </backupForm.Field>
                </FieldGroup>

                <Alert className="mt-4" variant="warning">
                  <AlertDescription>
                    Each backup code can only be used once.
                  </AlertDescription>
                </Alert>

                <backupForm.Subscribe selector={(s) => s.isSubmitting}>
                  {(isSubmitting) => (
                    <Button
                      className="mt-4 w-full"
                      disabled={isSubmitting}
                      size="lg"
                      type="submit"
                    >
                      {isSubmitting ? "Verifying..." : "Use backup code"}
                    </Button>
                  )}
                </backupForm.Subscribe>
              </form>
            )}

            <button
              className="mt-4 w-full text-center text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => setMode(mode === "totp" ? "backup" : "totp")}
              type="button"
            >
              {mode === "totp"
                ? "Use a backup code instead"
                : "Use authenticator app instead"}
            </button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
