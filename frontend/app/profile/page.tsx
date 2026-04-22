"use client";

import { User } from "lucide-react";
import { ofetch } from "ofetch";
import { useState } from "react";
import { KycStatusCard } from "@/components/features/profile/kyc-status-card";
import { KycVerificationWizard } from "@/components/features/profile/kyc-verification-wizard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { env } from "@/env";
import { useSession } from "@/lib/auth-client";

// Default KYC status ID (None - not started)
const KYC_STATUS_NONE = 1;

export default function ProfilePage() {
  const { data: session, isPending, refetch } = useSession();
  const [wizardOpen, setWizardOpen] = useState(false);

  const handleSubmitKyc = async () => {
    // Call the existing KYC simulation endpoint
    await ofetch(`${env.NEXT_PUBLIC_API_URL}/api/users/kyc/simulate`, {
      method: "POST",
      credentials: "include",
    });
    // Refetch the session so the UI updates to show "pending" status
    await refetch();
  };

  const handleStartVerification = () => {
    setWizardOpen(true);
  };

  const handleRetryVerification = () => {
    setWizardOpen(true);
  };

  if (isPending) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div>
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Please log in to view your profile.
      </div>
    );
  }

  // Get KYC status ID from session, default to "None" if not present
  const kycStatusId = session?.user?.kycStatusId ?? KYC_STATUS_NONE;

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

      {/* Personal Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-5 text-primary" />
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

      {/* KYC Status Card */}
      <KycStatusCard
        kycStatusId={kycStatusId}
        onRetryVerification={handleRetryVerification}
        onStartVerification={handleStartVerification}
      />

      {/* KYC Verification Wizard Dialog */}
      <KycVerificationWizard
        defaultName={session.user.name}
        onOpenChange={setWizardOpen}
        onSubmit={handleSubmitKyc}
        open={wizardOpen}
      />
    </div>
  );
}
