"use client";

import { Camera, CheckCircle, Lightbulb, Loader2, User } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { orpcClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { KycFormData } from "../kyc-verification-wizard";

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/heic";

type SelfieStepProps = {
  formData: KycFormData;
  updateFormData: (updates: Partial<KycFormData>) => void;
};

export function SelfieStep({ formData, updateFormData }: SelfieStepProps) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = async (file: File) => {
    setUploading(true);
    try {
      const { uploadUrl, key } = await orpcClient.users.getKycUploadUrl({
        fileType: "selfie",
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
      updateFormData({ selfieKey: key });
    } catch {
      toast.error("Photo upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const uploaded = formData.selfieKey.length > 0;

  return (
    <div className="space-y-6">
      <input
        accept={ACCEPTED_TYPES}
        capture="user"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleFileSelected(file);
          }
          e.target.value = "";
        }}
        ref={fileRef}
        type="file"
      />

      <button
        className={cn(
          "flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors",
          uploaded
            ? "border-success-500 bg-success-50/50 text-success-700 dark:bg-success-950/20 dark:text-success-400"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
          uploading && "pointer-events-none opacity-60"
        )}
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        type="button"
      >
        {uploading ? (
          <>
            <Loader2 className="size-12 animate-spin text-muted-foreground" />
            <span className="font-medium">Uploading photo...</span>
          </>
        ) : uploaded ? (
          <>
            <CheckCircle className="size-12" />
            <span className="font-medium">Photo uploaded successfully</span>
            <span className="text-muted-foreground text-sm">
              Click to retake
            </span>
          </>
        ) : (
          <>
            <div className="relative">
              <div className="flex size-20 items-center justify-center rounded-full bg-muted">
                <User className="size-10 text-muted-foreground" />
              </div>
              <div className="-right-1 -bottom-1 absolute flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Camera className="size-4" />
              </div>
            </div>
            <span className="font-medium">Take a selfie or upload a photo</span>
            <span className="text-muted-foreground text-sm">
              We&apos;ll compare this with your ID photo
            </span>
          </>
        )}
      </button>

      <div className="rounded-lg bg-muted/50 p-4">
        <div className="mb-3 flex items-center gap-2 font-medium text-sm">
          <Lightbulb className="size-4 text-highlight-600" />
          Tips for a good photo
        </div>
        <ol className="space-y-2 text-muted-foreground text-sm">
          {[
            "Face the camera directly with a neutral expression",
            "Ensure good lighting — avoid shadows on your face",
            "Remove glasses, hats, or anything covering your face",
            "Use a plain background if possible",
          ].map((tip, i) => (
            <li className="flex items-start gap-2" key={tip}>
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-xs">
                {i + 1}
              </span>
              <span>{tip}</span>
            </li>
          ))}
        </ol>
      </div>

      {!(uploaded || uploading) && (
        <Button
          className="w-full gap-2"
          onClick={() => fileRef.current?.click()}
        >
          <Camera className="size-4" />
          Take Photo
        </Button>
      )}
    </div>
  );
}
