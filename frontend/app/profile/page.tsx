"use client";

import { ShieldAlert, ShieldCheck, User } from "lucide-react";
import { ofetch } from "ofetch";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { env } from "@/env";
import { useSession } from "@/lib/auth-client";

export default function ProfilePage() {
  const { data: session, isPending, refetch } = useSession();
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSimulateKYC = async () => {
    setIsVerifying(true);
    try {
      await ofetch(`${env.NEXT_PUBLIC_API_URL}/api/users/kyc/simulate`, {
        method: "POST",
        credentials: "include",
      });
      // Refetch the session so the UI updates to show "verified" instantly!
      await refetch();
    } catch (_error) {
      // TODO: pino logger setup
    } finally {
      setIsVerifying(false);
    }
  };

  if (isPending) {
    return <div className="p-8">Loading profile...</div>;
  }

  if (!session) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Please log in to view your profile.
      </div>
    );
  }

  const KYC_STATUS_VERIFIED_ID = 3;

  // `user` property does not have kycStatusId property, but it should have
  const isVerified = session?.user?.kycStatusId === KYC_STATUS_VERIFIED_ID;

  return (
    <div className="fade-in mx-auto flex w-full max-w-2xl animate-in flex-col gap-6 duration-300 ease-out">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">
          Profile & Settings
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage your identity and account security.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Personal Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="font-medium text-muted-foreground text-sm">Name</p>
            <p className="text-base">{session.user.name}</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground text-sm">Email</p>
            <p className="text-base">{session.user.email}</p>
          </div>
        </CardContent>
      </Card>

      <Card
        className={
          isVerified
            ? "border-success-500/50 bg-success-50/10"
            : "border-highlight-500/50 bg-highlight-50/10"
        }
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isVerified ? (
              <ShieldCheck className="h-5 w-5 text-success-600" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-highlight-600" />
            )}
            Identity Verification (KYC)
          </CardTitle>
          <CardDescription>
            {isVerified
              ? "Your identity has been verified. You have full access to deposit and transfer funds."
              : "Financial regulations require us to verify your identity before you can add money to your account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isVerified && (
            <Button
              className="w-full bg-highlight-600 text-white hover:bg-highlight-700 sm:w-auto"
              disabled={isVerifying}
              onClick={handleSimulateKYC}
            >
              {isVerifying ? "Processing..." : "Simulate Verification"}
            </Button>
          )}
          {isVerified && (
            <div className="inline-flex items-center gap-2 rounded-full bg-success-100 px-3 py-1 font-medium text-sm text-success-700">
              Verified
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
