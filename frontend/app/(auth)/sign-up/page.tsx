"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp } from "@/lib/auth-client";

const MIN_PASSWORD_LENGTH = 8;

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPasswordError(null);

    // Validate password match
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    // Validate password length
    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
      );
      setIsLoading(false);
      return;
    }

    const result = await signUp.email({
      email,
      password,
      name,
      callbackURL: "/dashboard",
    });

    setIsLoading(false);

    if (result.error) {
      toast.error(
        result.error.message || "Failed to create account. Please try again."
      );
      return;
    }

    toast.success("Account created successfully. Please sign in.");
    router.push("/login");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <h1 className="font-bold text-2xl tracking-tight">OneCurrency</h1>
          <p className="mt-1.5 text-muted-foreground text-sm">
            Create your account
          </p>
        </div>

        {/* Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Get started</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              {/* Password Error */}
              {passwordError && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm">
                  {passwordError}
                </div>
              )}

              {/* Full name */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  autoComplete="name"
                  id="name"
                  name="name"
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  required
                  type="text"
                  value={name}
                />
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  autoComplete="email"
                  id="email"
                  name="email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  autoComplete="new-password"
                  id="password"
                  minLength={MIN_PASSWORD_LENGTH}
                  name="password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  type="password"
                  value={password}
                />
                <p className="text-muted-foreground text-xs">
                  Minimum 8 characters
                </p>
              </div>

              {/* Confirm password */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  autoComplete="new-password"
                  id="confirm-password"
                  name="confirmPassword"
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  type="password"
                  value={confirmPassword}
                />
              </div>

              {/* Terms */}
              <Label className="flex items-start gap-2.5 text-muted-foreground text-sm">
                <input
                  checked={agreedToTerms}
                  className="mt-0.5 rounded border-border accent-primary"
                  name="terms"
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  required
                  type="checkbox"
                />
                <span>
                  I agree to the{" "}
                  <Link
                    className="font-medium text-foreground hover:underline"
                    href="/terms"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    className="font-medium text-foreground hover:underline"
                    href="/privacy"
                  >
                    Privacy Policy
                  </Link>
                </span>
              </Label>

              {/* Submit */}
              <Button
                className="mt-1 w-full"
                disabled={isLoading}
                type="submit"
              >
                {isLoading ? "Creating account..." : "Create account"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="mt-4 text-center text-muted-foreground text-sm">
          Already have an account?{" "}
          <Link
            className="font-medium text-foreground hover:underline"
            href="/login"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
