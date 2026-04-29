"use client";

import { useForm } from "@tanstack/react-form";
import { Copy, Download, Shield, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { QRCode } from "react-qr-code";
import { toast } from "sonner";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient, useSession } from "@/lib/auth-client";

const MIN_PASSWORD_LENGTH = 8;
const TOTP_CODE_LENGTH = 6;
const DIGITS_ONLY_REGEX = /^\d+$/;

type SetupStep = "password" | "qr" | "backup-codes";

function Enable2FADialog({ onEnabled }: { onEnabled: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<SetupStep>("password");
  const [totpUri, setTotpUri] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const passwordForm = useForm({
    defaultValues: { password: "" },
    validators: {
      onSubmit: z.object({
        password: z.string().min(MIN_PASSWORD_LENGTH, "Enter your password"),
      }),
    },
    onSubmit: async ({ value }) => {
      const result = await authClient.twoFactor.enable({
        password: value.password,
      });
      if (result.error) {
        toast.error(result.error.message || "Incorrect password.");
        return;
      }
      setTotpUri(result.data?.totpURI ?? "");
      setBackupCodes(result.data?.backupCodes ?? []);
      setStep("qr");
    },
  });

  const codeForm = useForm({
    defaultValues: { code: "" },
    validators: {
      onSubmit: z.object({
        code: z
          .string()
          .length(TOTP_CODE_LENGTH, "Enter your 6-digit code")
          .regex(DIGITS_ONLY_REGEX, "Numbers only"),
      }),
    },
    onSubmit: async ({ value }) => {
      const result = await authClient.twoFactor.verifyTotp({
        code: value.code,
      });
      if (result.error) {
        toast.error(result.error.message || "Invalid code. Try again.");
        return;
      }
      setStep("backup-codes");
    },
  });

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setStep("password");
      setTotpUri("");
      setBackupCodes([]);
      passwordForm.reset();
      codeForm.reset();
    }
    setOpen(nextOpen);
  };

  const handleDone = () => {
    setOpen(false);
    onEnabled();
    toast.success("Two-factor authentication enabled");
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    toast.success("Backup codes copied");
  };

  const downloadBackupCodes = () => {
    const blob = new Blob([backupCodes.join("\n")], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "onecurrency-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog onOpenChange={handleClose} open={open}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            Set up two-factor authentication
          </Button>
        }
      />

      <DialogContent className="sm:max-w-md">
        {step === "password" && (
          <>
            <DialogHeader>
              <DialogTitle>Enable two-factor authentication</DialogTitle>
              <DialogDescription>
                Confirm your password to get started.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                passwordForm.handleSubmit();
              }}
            >
              <FieldGroup>
                <passwordForm.Field name="password">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                        <Input
                          aria-invalid={isInvalid}
                          autoComplete="current-password"
                          autoFocus
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="••••••••"
                          type="password"
                          value={field.state.value}
                        />
                        {isInvalid && (
                          <FieldError errors={field.state.meta.errors} />
                        )}
                      </Field>
                    );
                  }}
                </passwordForm.Field>
              </FieldGroup>
              <DialogFooter className="mt-4">
                <passwordForm.Subscribe selector={(s) => s.isSubmitting}>
                  {(isSubmitting) => (
                    <Button disabled={isSubmitting} type="submit">
                      {isSubmitting ? "Confirming..." : "Continue"}
                    </Button>
                  )}
                </passwordForm.Subscribe>
              </DialogFooter>
            </form>
          </>
        )}

        {step === "qr" && (
          <>
            <DialogHeader>
              <DialogTitle>Scan with your authenticator app</DialogTitle>
              <DialogDescription>
                Use Google Authenticator, Authy, or any TOTP app to scan this QR
                code, then enter the 6-digit code to confirm.
              </DialogDescription>
            </DialogHeader>

            <div className="flex justify-center rounded-lg bg-white p-4">
              <QRCode size={160} value={totpUri} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                codeForm.handleSubmit();
              }}
            >
              <FieldGroup>
                <codeForm.Field name="code">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>
                          Verification code
                        </FieldLabel>
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
                            if (val.length === TOTP_CODE_LENGTH) {
                              codeForm.handleSubmit();
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
                </codeForm.Field>
              </FieldGroup>
              <DialogFooter className="mt-4">
                <codeForm.Subscribe selector={(s) => s.isSubmitting}>
                  {(isSubmitting) => (
                    <Button disabled={isSubmitting} type="submit">
                      {isSubmitting ? "Verifying..." : "Verify & continue"}
                    </Button>
                  )}
                </codeForm.Subscribe>
              </DialogFooter>
            </form>
          </>
        )}

        {step === "backup-codes" && (
          <>
            <DialogHeader>
              <DialogTitle>Save your backup codes</DialogTitle>
              <DialogDescription>
                Store these in a safe place. Each code can only be used once to
                sign in if you lose access to your authenticator app.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-muted p-3 font-mono text-sm">
              {backupCodes.map((code) => (
                <span className="text-center tracking-wider" key={code}>
                  {code}
                </span>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={copyBackupCodes}
                size="sm"
                variant="outline"
              >
                <Copy className="size-4" />
                Copy
              </Button>
              <Button
                className="flex-1"
                onClick={downloadBackupCodes}
                size="sm"
                variant="outline"
              >
                <Download className="size-4" />
                Download
              </Button>
            </div>

            <Alert variant="warning">
              <AlertDescription>
                These codes won't be shown again. Save them now.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button onClick={handleDone}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Disable2FADialog({ onDisabled }: { onDisabled: () => void }) {
  const [open, setOpen] = useState(false);

  const form = useForm({
    defaultValues: { password: "" },
    validators: {
      onSubmit: z.object({
        password: z.string().min(1, "Enter your password"),
      }),
    },
    onSubmit: async ({ value }) => {
      const result = await authClient.twoFactor.disable({
        password: value.password,
      });
      if (result.error) {
        toast.error(result.error.message || "Incorrect password.");
        return;
      }
      setOpen(false);
      onDisabled();
      toast.success("Two-factor authentication disabled");
    },
  });

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            Disable
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disable two-factor authentication</DialogTitle>
          <DialogDescription>
            Confirm your password to remove the extra layer of security from
            your account.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field name="password">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                    <Input
                      aria-invalid={isInvalid}
                      autoComplete="current-password"
                      autoFocus
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="••••••••"
                      type="password"
                      value={field.state.value}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            </form.Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <Button
                  disabled={isSubmitting}
                  type="submit"
                  variant="destructive"
                >
                  {isSubmitting ? "Disabling..." : "Disable 2FA"}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SecurityCard() {
  const { data: session, refetch } = useSession();
  const is2FAEnabled = session?.user?.twoFactorEnabled ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {is2FAEnabled ? (
            <ShieldCheck className="size-5 text-success-500" />
          ) : (
            <Shield className="size-5 text-primary" />
          )}
          Security
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-sm">Two-factor authentication</p>
            <p className="text-muted-foreground text-sm">
              {is2FAEnabled
                ? "Your account is protected with an authenticator app."
                : "Add an extra layer of security to your account."}
            </p>
          </div>
          {is2FAEnabled ? (
            <Disable2FADialog onDisabled={() => refetch()} />
          ) : (
            <Enable2FADialog onEnabled={() => refetch()} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
