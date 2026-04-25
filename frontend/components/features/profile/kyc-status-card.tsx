"use client";

import {
  AlertCircle,
  Clock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { KYC_STATUS } from "@/common/constants/kyc";
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
import {
  Progress,
  ProgressIndicator,
  ProgressTrack,
} from "@/components/ui/progress";

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
  // None — KYC not started
  if (kycStatusId === KYC_STATUS.NONE) {
    return (
      <Card variant="warning">
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
            className="w-full sm:w-auto"
            onClick={onStartVerification}
            variant="primary"
          >
            Start Verification
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Pending — Under review
  if (kycStatusId === KYC_STATUS.PENDING) {
    return (
      <Card variant="primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5 text-primary-600" />
            Verification In Progress
          </CardTitle>
          <CardDescription>
            We&apos;re reviewing your documents. This usually takes 1–2 business
            days. We&apos;ll notify you once the review is complete.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={PENDING_PROGRESS_VALUE}>
            <ProgressTrack>
              <ProgressIndicator color="default" />
            </ProgressTrack>
          </Progress>
          <Badge variant="primary">
            <Clock className="size-3" data-icon="inline-start" />
            Under Review
          </Badge>
        </CardContent>
      </Card>
    );
  }

  // Verified — Success state
  if (kycStatusId === KYC_STATUS.VERIFIED) {
    return (
      <Card variant="success">
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
          <Badge variant="success">
            <ShieldCheck className="size-3" data-icon="inline-start" />
            Verified
          </Badge>
        </CardContent>
      </Card>
    );
  }

  // Rejected — Error state with retry
  if (kycStatusId === KYC_STATUS.REJECTED) {
    return (
      <Card variant="destructive">
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

  // Expired — Needs renewal
  if (kycStatusId === KYC_STATUS.EXPIRED) {
    return (
      <Card variant="warning">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5 text-highlight-600" />
            Verification Expired
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="warning">
            <Clock className="size-4" />
            <AlertTitle>Renewal Required</AlertTitle>
            <AlertDescription>
              Your identity verification has expired. Please complete the
              verification process again to continue using all features.
            </AlertDescription>
            <AlertAction>
              <Button
                className="gap-1.5"
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
