"use client";

import { useQuery } from "@tanstack/react-query";
import { Link2, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { KYC_STATUS } from "@/common/constants/kyc";
import { KycStatusCard } from "@/components/features/profile/kyc-status-card";
import {
  type KycFormData,
  KycVerificationWizard,
} from "@/components/features/profile/kyc-verification-wizard";
import { SecurityCard } from "@/components/features/profile/security-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { orpcClient } from "@/lib/api";
import { useSession } from "@/lib/auth-client";

export default function ProfilePage() {
  const { data: session, isPending, refetch } = useSession();
  const [wizardOpen, setWizardOpen] = useState(false);

  const kycStatusId = session?.user?.kycStatusId ?? KYC_STATUS.NONE;

  const { data: latestSubmission } = useQuery({
    queryKey: ["kyc-latest-submission"],
    queryFn: () => orpcClient.users.getLatestKycSubmission({}),
    enabled: kycStatusId === KYC_STATUS.REJECTED,
  });

  const handleSubmitKyc = async (data: KycFormData) => {
    if (!data.dateOfBirth) {
      toast.error("Date of birth is required");
      return;
    }
    try {
      await orpcClient.users.submitKyc({
        fullName: data.fullName,
        dateOfBirth: data.dateOfBirth,
        nationality: data.nationality,
        documentType: data.documentType as
          | "passport"
          | "drivers_license"
          | "national_id",
        documentFrontKey: data.documentFrontKey,
        documentBackKey: data.documentBackKey,
        selfieKey: data.selfieKey,
      });
      toast.success("Verification submitted", {
        description: "We'll review your documents within 1-2 business days.",
      });
      await refetch();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to submit verification";
      toast.error("Submission failed", { description: message });
      throw error;
    }
  };

  const handleSimulateKyc = async () => {
    try {
      await orpcClient.users.simulateKyc({});
      toast.success("Identity verified (simulated)");
      await refetch();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to simulate verification";
      toast.error("Simulation failed", { description: message });
    }
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

      <SecurityCard />

      <KycStatusCard
        kycStatusId={kycStatusId}
        onRetryVerification={() => setWizardOpen(true)}
        onStartVerification={() => setWizardOpen(true)}
        rejectionReason={latestSubmission?.rejectionReason ?? undefined}
      />

      {/* Linked Account — External wallet for Managed Recovery (coming soon) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="size-5 text-primary" />
            External Linked Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Link an external account to enable Managed Recovery and additional
            access options. Your OneCurrency Account balance is unaffected.
          </p>
          <appkit-button />
        </CardContent>
      </Card>

      <KycVerificationWizard
        defaultName={session.user.name}
        onOpenChange={setWizardOpen}
        onSubmit={handleSubmitKyc}
        open={wizardOpen}
      />

      {kycStatusId === KYC_STATUS.PENDING && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm">
              Development Tools
            </CardTitle>
          </CardHeader>
          <CardContent>
            <button
              className="rounded-md border border-muted-foreground/30 px-3 py-1 text-muted-foreground text-xs hover:bg-muted"
              onClick={handleSimulateKyc}
              type="button"
            >
              Simulate Verification (Dev)
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
