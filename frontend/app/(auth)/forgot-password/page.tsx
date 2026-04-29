"use client";

import { useForm } from "@tanstack/react-form";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

const schema = z.object({
  email: z.email("Enter a valid email address"),
});

const FRONTEND_URL =
  typeof window !== "undefined" ? window.location.origin : "";

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const form = useForm({
    defaultValues: { email: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      // Always show success regardless of whether email exists —
      // prevents user enumeration (OWASP best practice)
      await authClient.requestPasswordReset({
        email: value.email,
        redirectTo: `${FRONTEND_URL}/reset-password`,
      });
      setSubmitted(true);
    },
  });

  if (submitted) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 sm:py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary shadow-sm">
              <span className="font-bold text-2xl text-primary-foreground">
                1
              </span>
            </div>
            <h1 className="font-bold text-2xl tracking-tight">
              OneCurrency
            </h1>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-8">
              <CheckCircle2 className="size-10 text-success-500" />
              <div className="text-center">
                <p className="font-medium text-base">Check your inbox</p>
                <p className="mt-1 text-muted-foreground text-sm">
                  If that email is registered, you'll receive a reset link
                  shortly. Check your spam folder if it doesn't arrive.
                </p>
              </div>
              <Link
                className="text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
                href="/login"
              >
                Back to sign in
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

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
            <h1 className="font-bold text-2xl tracking-tight">
              OneCurrency
            </h1>
            <p className="mt-1 text-muted-foreground text-sm">
              Reset your password
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Forgot password?</CardTitle>
            <CardDescription>
              Enter your email and we'll send you a reset link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                form.handleSubmit();
              }}
            >
              <FieldGroup>
                <form.Field name="email">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched &&
                      !field.state.meta.isValid;
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                        <Input
                          aria-invalid={isInvalid}
                          autoComplete="email"
                          autoFocus
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(e) =>
                            field.handleChange(e.target.value)
                          }
                          placeholder="you@example.com"
                          type="email"
                          value={field.state.value}
                        />
                        {isInvalid && (
                          <FieldError
                            errors={field.state.meta.errors}
                          />
                        )}
                      </Field>
                    );
                  }}
                </form.Field>
              </FieldGroup>

              <form.Subscribe selector={(s) => s.isSubmitting}>
                {(isSubmitting) => (
                  <Button
                    className="mt-6 w-full"
                    disabled={isSubmitting}
                    size="lg"
                    type="submit"
                  >
                    {isSubmitting
                      ? "Sending..."
                      : "Send reset link"}
                  </Button>
                )}
              </form.Subscribe>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-muted-foreground text-sm">
          Remember your password?{" "}
          <Link
            className="font-medium text-foreground underline-offset-4 hover:underline"
            href="/login"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
