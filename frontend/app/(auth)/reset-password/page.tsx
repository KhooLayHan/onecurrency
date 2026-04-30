"use client";

import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

const MIN_PASSWORD_LENGTH = 8;

const schema = z
  .object({
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `At least ${MIN_PASSWORD_LENGTH} characters`),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
  });

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const isExpired = searchParams.get("error") === "INVALID_TOKEN";

  const form = useForm({
    defaultValues: { password: "", confirmPassword: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      if (!token) {
        return;
      }
      const result = await authClient.resetPassword({
        newPassword: value.password,
        token,
      });
      if (result.error) {
        toast.error(
          result.error.message || "Reset link is invalid or has expired."
        );
        return;
      }
      toast.success("Password updated. Please sign in.");
      router.push("/login");
    },
  });

  const isInvalidState = isExpired || !token;

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
              Set a new password
            </p>
          </div>
        </div>

        {isInvalidState ? (
          <div className="flex flex-col gap-4">
            <Alert variant="destructive">
              <AlertTitle>Reset link invalid or expired</AlertTitle>
              <AlertDescription>
                This link may have already been used or has expired. Reset links
                are valid for 1 hour.
              </AlertDescription>
            </Alert>
            <Link
              className="text-center text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
              href="/forgot-password"
            >
              Request a new reset link
            </Link>
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Choose a new password</CardTitle>
                <CardDescription>
                  Your new password must be at least {MIN_PASSWORD_LENGTH}{" "}
                  characters.
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
                    <form.Field name="password">
                      {(field) => {
                        const isInvalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name}>
                              New password
                            </FieldLabel>
                            <Input
                              aria-invalid={isInvalid}
                              autoComplete="new-password"
                              id={field.name}
                              minLength={MIN_PASSWORD_LENGTH}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                              placeholder="••••••••"
                              type="password"
                              value={field.state.value}
                            />
                            <FieldDescription>
                              Minimum {MIN_PASSWORD_LENGTH} characters
                            </FieldDescription>
                            {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                            )}
                          </Field>
                        );
                      }}
                    </form.Field>

                    <form.Field name="confirmPassword">
                      {(field) => {
                        const isInvalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name}>
                              Confirm new password
                            </FieldLabel>
                            <Input
                              aria-invalid={isInvalid}
                              autoComplete="new-password"
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
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

                  <form.Subscribe selector={(s) => s.isSubmitting}>
                    {(isSubmitting) => (
                      <Button
                        className="mt-6 w-full"
                        disabled={isSubmitting}
                        size="lg"
                        type="submit"
                      >
                        {isSubmitting ? "Updating..." : "Update password"}
                      </Button>
                    )}
                  </form.Subscribe>
                </form>
              </CardContent>
            </Card>

            <p className="mt-6 text-center text-muted-foreground text-sm">
              <Link
                className="font-medium text-foreground underline-offset-4 hover:underline"
                href="/login"
              >
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
