"use client";

import { CheckCircle, CreditCard, FileText, Upload } from "lucide-react";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { KycFormData } from "../kyc-verification-wizard";

// Document type options
const DOCUMENT_TYPES = [
  {
    value: "passport",
    label: "Passport",
    description: "International travel document",
    icon: FileText,
    requiresBack: false,
  },
  {
    value: "drivers_license",
    label: "Driver's License",
    description: "Government-issued driving permit",
    icon: CreditCard,
    requiresBack: true,
  },
  {
    value: "national_id",
    label: "National ID Card",
    description: "Government-issued identity card",
    icon: CreditCard,
    requiresBack: true,
  },
] as const;

type DocumentUploadStepProps = {
  formData: KycFormData;
  updateFormData: (updates: Partial<KycFormData>) => void;
};

export function DocumentUploadStep({
  formData,
  updateFormData,
}: DocumentUploadStepProps) {
  const selectedDocType = DOCUMENT_TYPES.find(
    (d) => d.value === formData.documentType
  );
  const requiresBack = selectedDocType?.requiresBack ?? true;

  const handleFrontUpload = () => {
    // Simulated upload - in real app, this would handle file selection
    updateFormData({ documentFrontUploaded: true });
  };

  const handleBackUpload = () => {
    // Simulated upload - in real app, this would handle file selection
    updateFormData({ documentBackUploaded: true });
  };

  return (
    <div className="space-y-6">
      {/* Document Type Selection */}
      <FieldSet>
        <FieldLegend variant="label">Document Type</FieldLegend>
        <FieldDescription>
          Select the type of ID you&apos;ll be uploading.
        </FieldDescription>
        <RadioGroup
          className="mt-3"
          onValueChange={(value) =>
            updateFormData({
              documentType: value,
              documentFrontUploaded: false,
              documentBackUploaded: false,
            })
          }
          value={formData.documentType}
        >
          {DOCUMENT_TYPES.map((docType) => (
            <FieldLabel
              htmlFor={`doc-type-${docType.value}`}
              key={docType.value}
            >
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle className="flex items-center gap-2">
                    <docType.icon className="size-4 text-muted-foreground" />
                    {docType.label}
                  </FieldTitle>
                  <FieldDescription>{docType.description}</FieldDescription>
                </FieldContent>
                <RadioGroupItem
                  id={`doc-type-${docType.value}`}
                  value={docType.value}
                />
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>
      </FieldSet>

      {/* Upload Zones - only show when document type is selected */}
      {formData.documentType && (
        <div className="space-y-4">
          {/* Front of Document */}
          <Field>
            <FieldLabel>Front of Document</FieldLabel>
            <UploadZone
              label="Upload front side"
              onUpload={handleFrontUpload}
              uploaded={formData.documentFrontUploaded}
            />
          </Field>

          {/* Back of Document - only for cards that have a back */}
          {requiresBack && (
            <Field>
              <FieldLabel>Back of Document</FieldLabel>
              <UploadZone
                label="Upload back side"
                onUpload={handleBackUpload}
                uploaded={formData.documentBackUploaded}
              />
            </Field>
          )}
        </div>
      )}
    </div>
  );
}

// Simulated upload zone component
type UploadZoneProps = {
  uploaded: boolean;
  onUpload: () => void;
  label: string;
};

function UploadZone({ uploaded, onUpload, label }: UploadZoneProps) {
  return (
    <button
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors",
        uploaded
          ? "border-success-500 bg-success-50/50 text-success-700 dark:bg-success-950/20 dark:text-success-400"
          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
      )}
      onClick={onUpload}
      type="button"
    >
      {uploaded ? (
        <>
          <CheckCircle className="size-8" />
          <span className="font-medium text-sm">Document uploaded</span>
          <span className="text-muted-foreground text-xs">
            Click to replace
          </span>
        </>
      ) : (
        <>
          <Upload className="size-8 text-muted-foreground" />
          <span className="font-medium text-sm">{label}</span>
          <span className="text-muted-foreground text-xs">
            Click to select or drag and drop
          </span>
        </>
      )}
    </button>
  );
}
