"use client";

import { format } from "date-fns";
import { CheckCircle, FileText, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { KycFormData } from "../kyc-verification-wizard";

// Nationality label mapping
const NATIONALITY_LABELS: Record<string, string> = {
  MY: "Malaysian",
  SG: "Singaporean",
  PH: "Filipino",
  ID: "Indonesian",
  TH: "Thai",
  VN: "Vietnamese",
  US: "American",
  GB: "British",
  AU: "Australian",
  IN: "Indian",
  CN: "Chinese",
  JP: "Japanese",
  KR: "Korean",
};

// Document type label mapping
const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  passport: "Passport",
  drivers_license: "Driver's License",
  national_id: "National ID Card",
};

type ReviewStepProps = {
  formData: KycFormData;
};

export function ReviewStep({ formData }: ReviewStepProps) {
  const nationalityLabel =
    NATIONALITY_LABELS[formData.nationality] || formData.nationality;
  const documentTypeLabel =
    DOCUMENT_TYPE_LABELS[formData.documentType] || formData.documentType;

  return (
    <Card className="border-0 shadow-none">
      <CardContent className="space-y-4 p-0">
        {/* Personal Information Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 font-medium text-sm">
            <User className="size-4 text-muted-foreground" />
            Personal Information
          </div>
          <div className="grid gap-2 rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Full Name</span>
              <span className="font-medium">{formData.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date of Birth</span>
              <span className="font-medium">
                {formData.dateOfBirth
                  ? format(formData.dateOfBirth, "PPP")
                  : "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nationality</span>
              <span className="font-medium">{nationalityLabel}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Document Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 font-medium text-sm">
            <FileText className="size-4 text-muted-foreground" />
            Identity Document
          </div>
          <div className="grid gap-2 rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Document Type</span>
              <span className="font-medium">{documentTypeLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Front</span>
              <UploadedBadge uploaded={formData.documentFrontUploaded} />
            </div>
            {formData.documentType !== "passport" && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Back</span>
                <UploadedBadge uploaded={formData.documentBackUploaded} />
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Selfie Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 font-medium text-sm">
            <User className="size-4 text-muted-foreground" />
            Photo Verification
          </div>
          <div className="grid gap-2 rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Selfie</span>
              <UploadedBadge uploaded={formData.selfieUploaded} />
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-muted-foreground text-xs">
          By submitting, you confirm that the information provided is accurate
          and that you consent to our verification process. Your documents will
          be securely processed and stored in accordance with our privacy
          policy.
        </div>
      </CardContent>
    </Card>
  );
}

function UploadedBadge({ uploaded }: { uploaded: boolean }) {
  if (uploaded) {
    return (
      <Badge className="gap-1 bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400">
        <CheckCircle className="size-3" data-icon="inline-start" />
        Uploaded
      </Badge>
    );
  }
  return (
    <Badge className="text-muted-foreground" variant="secondary">
      Not uploaded
    </Badge>
  );
}
