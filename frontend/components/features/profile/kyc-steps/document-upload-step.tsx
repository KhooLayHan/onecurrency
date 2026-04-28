"use client";

import {
  CheckCircle,
  CreditCard,
  FileText,
  Loader2,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
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
import { orpcClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { KycFormData } from "../kyc-verification-wizard";

const ACCEPTED_TYPES =
  "image/jpeg,image/png,image/webp,image/heic,application/pdf";

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
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

  const selectedDocType = DOCUMENT_TYPES.find(
    (d) => d.value === formData.documentType
  );
  const requiresBack = selectedDocType?.requiresBack ?? true;

  const uploadFile = async (
    file: File,
    fileType: "front" | "back",
    setLoading: (v: boolean) => void,
    onSuccess: (key: string) => void
  ) => {
    setLoading(true);
    try {
      const { uploadUrl, key } = await orpcClient.users.getKycUploadUrl({
        fileType,
        contentType: file.type,
      });
      const res = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!res.ok) {
        throw new Error("Upload failed");
      }
      onSuccess(key);
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
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
              documentFrontKey: "",
              documentBackKey: "",
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

      {formData.documentType && (
        <div className="space-y-4">
          <input
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                uploadFile(file, "front", setUploadingFront, (key) =>
                  updateFormData({ documentFrontKey: key })
                );
              }
              e.target.value = "";
            }}
            ref={frontRef}
            type="file"
          />
          <Field>
            <FieldLabel>Front of Document</FieldLabel>
            <UploadZone
              label="Upload front side"
              onUpload={() => frontRef.current?.click()}
              uploaded={formData.documentFrontKey.length > 0}
              uploading={uploadingFront}
            />
          </Field>

          {requiresBack && (
            <>
              <input
                accept={ACCEPTED_TYPES}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    uploadFile(file, "back", setUploadingBack, (key) =>
                      updateFormData({ documentBackKey: key })
                    );
                  }
                  e.target.value = "";
                }}
                ref={backRef}
                type="file"
              />
              <Field>
                <FieldLabel>Back of Document</FieldLabel>
                <UploadZone
                  label="Upload back side"
                  onUpload={() => backRef.current?.click()}
                  uploaded={formData.documentBackKey.length > 0}
                  uploading={uploadingBack}
                />
              </Field>
            </>
          )}
        </div>
      )}
    </div>
  );
}

type UploadZoneProps = {
  uploaded: boolean;
  uploading: boolean;
  onUpload: () => void;
  label: string;
};

function UploadZone({ uploaded, uploading, onUpload, label }: UploadZoneProps) {
  return (
    <button
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors",
        uploaded
          ? "border-success-500 bg-success-50/50 text-success-700 dark:bg-success-950/20 dark:text-success-400"
          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
        uploading && "pointer-events-none opacity-60"
      )}
      disabled={uploading}
      onClick={onUpload}
      type="button"
    >
      <UploadZoneContent
        label={label}
        uploaded={uploaded}
        uploading={uploading}
      />
    </button>
  );
}

function UploadZoneContent({
  uploading,
  uploaded,
  label,
}: {
  uploading: boolean;
  uploaded: boolean;
  label: string;
}) {
  if (uploading) {
    return (
      <>
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <span className="font-medium text-sm">Uploading...</span>
      </>
    );
  }
  if (uploaded) {
    return (
      <>
        <CheckCircle className="size-8" />
        <span className="font-medium text-sm">Document uploaded</span>
        <span className="text-muted-foreground text-xs">Click to replace</span>
      </>
    );
  }
  return (
    <>
      <Upload className="size-8 text-muted-foreground" />
      <span className="font-medium text-sm">{label}</span>
      <span className="text-muted-foreground text-xs">
        Click to select or drag and drop
      </span>
    </>
  );
}
