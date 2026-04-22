"use client";

import {
  AlertCircle,
  Clock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress, ProgressLabel } from "@/components/ui/progress";

// KYC Status IDs from database schema (kyc_statuses lookup table)
const KYC_STATUS_NONE = 1;
const KYC_STATUS_PENDING = 2;
const KYC_STATUS_VERIFIED = 3;
const KYC_STATUS_REJECTED = 4;
const KYC_STATUS_EXPIRED = 5;

// Progress indicator value for pending state (indeterminate feel)
const PENDING_PROGRESS_VALUE = 66;

type KycStatusCardProps = {
  kycStatusId: number;
  rejectionReason?: string;
  onStartVerification: () => void;
  onRetryVerification: () => void;
};

export function KycStatusCard({
  kycStatusId,
  rejectionReason,
  onStartVerification,
  onRetryVerification,
}: KycStatusCardProps) {
  // None - KYC not started
  if (kycStatusId === KYC_STATUS_NONE) {
    return (
      <Card className="border-highlight-500/50 bg-highlight-50/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-highlight-600" />
            Identity Verification Required
          </CardTitle>
          <CardDescription>
            Financial regulations require us to verify your identity before you
            can add money to your account. This helps keep your funds secure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full bg-highlight-600 text-white hover:bg-highlight-700 sm:w-auto"
            onClick={onStartVerification}
          >
            Start Verification
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Pending - Under review
  if (kycStatusId === KYC_STATUS_PENDING) {
    return (
      <Card className="border-primary-500/50 bg-primary-50/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5 text-primary-600" />
            Verification In Progress
          </CardTitle>
          <CardDescription>
            We&apos;re reviewing your documents. This usually takes 1-2 business
            days. We&apos;ll notify you once the review is complete.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={PENDING_PROGRESS_VALUE}>
            <ProgressLabel>Review progress</ProgressLabel>
          </Progress>
          <Badge className="gap-1.5" variant="secondary">
            <Clock className="size-3" data-icon="inline-start" />
            Under Review
          </Badge>
        </CardContent>
      </Card>
    );
  }

  // Verified - Success state
  if (kycStatusId === KYC_STATUS_VERIFIED) {
    return (
      <Card className="border-success-500/50 bg-success-50/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-success-600" />
            Identity Verified
          </CardTitle>
          <CardDescription>
            Your identity has been verified. You have full access to deposit and
            transfer funds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge className="gap-1.5 bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400">
            <ShieldCheck className="size-3" data-icon="inline-start" />
            Verified
          </Badge>
        </CardContent>
      </Card>
    );
  }

  // Rejected - Error state with retry
  if (kycStatusId === KYC_STATUS_REJECTED) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="size-5 text-destructive" />
            Verification Unsuccessful
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Verification Rejected</AlertTitle>
            <AlertDescription>
              {rejectionReason ||
                "We couldn't verify your identity with the documents provided. Please try again with clearer images."}
            </AlertDescription>
            <AlertAction>
              <Button
                className="gap-1.5"
                onClick={onRetryVerification}
                size="sm"
                variant="outline"
              >
                <RefreshCw className="size-3" />
                Try Again
              </Button>
            </AlertAction>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Expired - Needs renewal
  if (kycStatusId === KYC_STATUS_EXPIRED) {
    return (
      <Card className="border-highlight-500/50 bg-highlight-50/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5 text-highlight-600" />
            Verification Expired
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-highlight-500/30 bg-highlight-50 text-highlight-800 dark:border-highlight-500/20 dark:bg-highlight-950/50 dark:text-highlight-200">
            <Clock className="size-4" />
            <AlertTitle>Renewal Required</AlertTitle>
            <AlertDescription>
              Your identity verification has expired. Please complete the
              verification process again to continue using all features.
            </AlertDescription>
            <AlertAction>
              <Button
                className="gap-1.5 border-highlight-600/30 text-highlight-700 hover:bg-highlight-100 dark:border-highlight-500/30 dark:text-highlight-300 dark:hover:bg-highlight-900/30"
                onClick={onRetryVerification}
                size="sm"
                variant="outline"
              >
                <RefreshCw className="size-3" />
                Renew
              </Button>
            </AlertAction>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Fallback for unknown status
  return null;
}
