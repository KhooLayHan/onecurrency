"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, ExternalLink, XCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { KYC_STATUS } from "@/common/constants/kyc";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { orpcClient } from "@/lib/api";

const DOC_TYPE_LABEL: Record<string, string> = {
  passport: "Passport",
  drivers_license: "Driver's License",
  national_id: "National ID",
};

const NATIONALITY_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

const HTTP_STATUS_NOT_FOUND = 404;

export default function KycDetailPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const {
    data,
    isLoading,
    isError,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["admin-kyc-submission", publicId],
    queryFn: () => orpcClient.admin.kyc.getSubmission({ publicId }),
  });

  const approveMutation = useMutation({
    mutationFn: () => orpcClient.admin.kyc.approve({ publicId }),
    onSuccess: () => {
      toast.success("KYC approved successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-kyc-submissions"] });
      queryClient.invalidateQueries({
        queryKey: ["admin-kyc-submission", publicId],
      });
      setShowApproveDialog(false);
    },
    onError: (error) => {
      toast.error("Failed to approve", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      orpcClient.admin.kyc.reject({ publicId, reason: rejectionReason }),
    onSuccess: () => {
      toast.success("KYC rejected");
      queryClient.invalidateQueries({ queryKey: ["admin-kyc-submissions"] });
      queryClient.invalidateQueries({
        queryKey: ["admin-kyc-submission", publicId],
      });
      setShowRejectDialog(false);
      setRejectionReason("");
    },
    onError: (error) => {
      toast.error("Failed to reject", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  const submission = data?.submission;
  const isPending = submission?.kycStatusId === KYC_STATUS.PENDING;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError) {
    return <QueryErrorState error={queryError} refetch={refetch} />;
  }

  if (!submission) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Submission not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          onClick={() => router.push("/admin/kyc")}
          size="sm"
          variant="outline"
        >
          <ArrowLeft className="mr-1 size-4" />
          Back
        </Button>
        <div>
          <h1 className="font-bold text-2xl tracking-tight">
            {submission.fullName}
          </h1>
          <p className="text-muted-foreground text-sm">
            Submitted {new Date(submission.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identity Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Full Name" value={submission.fullName} />
            <Row
              label="Date of Birth"
              value={new Date(submission.dateOfBirth).toLocaleDateString(
                "en-US",
                {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }
              )}
            />
            <Row
              label="Nationality"
              value={
                NATIONALITY_NAMES.of(submission.nationality) ??
                submission.nationality
              }
            />
            <Row
              label="Document Type"
              value={
                DOC_TYPE_LABEL[submission.documentType] ??
                submission.documentType
              }
            />
          </CardContent>
        </Card>

        <Card variant={isPending ? "warning" : "default"}>
          <CardHeader>
            <CardTitle className="text-base">
              {isPending ? "Action Required — Review Status" : "Review Status"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Status:</span>
              <StatusBadge kycStatusId={submission.kycStatusId} />
            </div>

            {submission.rejectionReason && (
              <div>
                <p className="mb-1 font-medium text-destructive text-sm">
                  Rejection Reason:
                </p>
                <p className="text-sm">{submission.rejectionReason}</p>
              </div>
            )}

            {isPending && (
              <ReviewActions
                onApprove={() => setShowApproveDialog(true)}
                onReject={() => setShowRejectDialog(true)}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submitted Documents</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <DocumentViewer
            label="Front of Document"
            url={data?.documentFrontUrl ?? null}
          />
          <DocumentViewer
            label="Back of Document"
            url={data?.documentBackUrl ?? null}
          />
          <DocumentViewer label="Selfie" url={data?.selfieUrl ?? null} />
        </CardContent>
      </Card>

      <AlertDialog
        onOpenChange={(open) => {
          if (!approveMutation.isPending) {
            setShowApproveDialog(open);
          }
        }}
        open={showApproveDialog}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Approve KYC Submission?</AlertDialogTitle>
            <AlertDialogDescription>
              This will verify {submission.fullName}&apos;s identity and grant
              full account access. This action is logged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              disabled={approveMutation.isPending}
              onClick={() => approveMutation.mutate()}
            >
              {approveMutation.isPending ? "Approving..." : "Approve"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        onOpenChange={(open) => {
          if (!rejectMutation.isPending) {
            setShowRejectDialog(open);
          }
        }}
        open={showRejectDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject KYC Submission</AlertDialogTitle>
            <AlertDialogDescription>
              Provide a reason for rejection. This will be shown to the user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            className="my-2"
            minLength={10}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="e.g. Document image is blurry or illegible. Please resubmit with a clearer photo."
            rows={3}
            value={rejectionReason}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              disabled={rejectionReason.length < 10 || rejectMutation.isPending}
              onClick={() => rejectMutation.mutate()}
              variant="destructive"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Submission"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const STATUS_CONFIG: Record<
  number,
  {
    variant: "default" | "warning" | "success" | "destructive" | "primary";
    label: string;
  }
> = {
  [KYC_STATUS.PENDING]: { variant: "warning", label: "Pending Review" },
  [KYC_STATUS.VERIFIED]: { variant: "success", label: "Verified" },
  [KYC_STATUS.REJECTED]: { variant: "destructive", label: "Rejected" },
};

function QueryErrorState({
  error,
  refetch,
}: {
  error: unknown;
  refetch: () => void;
}) {
  const is404 =
    (error as { status?: number })?.status === HTTP_STATUS_NOT_FOUND;
  if (is404) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Submission not found.
      </div>
    );
  }
  return (
    <div className="space-y-4 py-16 text-center">
      <p className="text-muted-foreground">
        Failed to load submission:{" "}
        {error instanceof Error ? error.message : "Unknown error"}
      </p>
      <Button onClick={() => refetch()} size="sm" variant="outline">
        Retry
      </Button>
    </div>
  );
}

function StatusBadge({ kycStatusId }: { kycStatusId: number }) {
  const config = STATUS_CONFIG[kycStatusId] ?? {
    variant: "default",
    label: "Unknown",
  };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function ReviewActions({
  onApprove,
  onReject,
}: {
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex gap-2 pt-2">
      <Button className="flex-1 gap-1.5" onClick={onApprove} variant="primary">
        <CheckCircle className="size-4" />
        Approve
      </Button>
      <Button
        className="flex-1 gap-1.5"
        onClick={onReject}
        variant="destructive"
      >
        <XCircle className="size-4" />
        Reject
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function DocumentViewer({ label, url }: { label: string; url: string | null }) {
  if (!url) {
    return (
      <div className="flex flex-col gap-2">
        <p className="font-medium text-sm">{label}</p>
        <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground text-sm">
          Not submitted
        </div>
      </div>
    );
  }

  const isPdf = url.includes(".pdf") || url.includes("application/pdf");

  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium text-sm">{label}</p>
      {isPdf ? (
        <Link
          className="flex h-40 items-center justify-center gap-2 rounded-lg border bg-muted/50 text-sm hover:bg-muted"
          href={url}
          rel="noopener noreferrer"
          target="_blank"
        >
          <ExternalLink className="size-4" />
          View PDF
        </Link>
      ) : (
        <Link
          className="relative block h-40 w-full"
          href={url}
          rel="noopener noreferrer"
          target="_blank"
        >
          <Image
            alt={label}
            className="rounded-lg border object-cover"
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            src={url}
          />
        </Link>
      )}
    </div>
  );
}
