"use client";

import { Camera, CheckCircle, Lightbulb, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { KycFormData } from "../kyc-verification-wizard";

type SelfieStepProps = {
  formData: KycFormData;
  updateFormData: (updates: Partial<KycFormData>) => void;
};

export function SelfieStep({ formData, updateFormData }: SelfieStepProps) {
  const handleUpload = () => {
    // Simulated upload - in real app, this would trigger camera or file picker
    updateFormData({ selfieUploaded: true });
  };

  return (
    <div className="space-y-6">
      {/* Selfie Upload Zone */}
      <button
        className={cn(
          "flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors",
          formData.selfieUploaded
            ? "border-success-500 bg-success-50/50 text-success-700 dark:bg-success-950/20 dark:text-success-400"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
        )}
        onClick={handleUpload}
        type="button"
      >
        {formData.selfieUploaded ? (
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

      {/* Instructions */}
      <div className="rounded-lg bg-muted/50 p-4">
        <div className="mb-3 flex items-center gap-2 font-medium text-sm">
          <Lightbulb className="size-4 text-highlight-600" />
          Tips for a good photo
        </div>
        <ol className="space-y-2 text-muted-foreground text-sm">
          <li className="flex items-start gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-xs">
              1
            </span>
            <span>Face the camera directly with a neutral expression</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-xs">
              2
            </span>
            <span>Ensure good lighting - avoid shadows on your face</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-xs">
              3
            </span>
            <span>Remove glasses, hats, or anything covering your face</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-xs">
              4
            </span>
            <span>Use a plain background if possible</span>
          </li>
        </ol>
      </div>

      {!formData.selfieUploaded && (
        <Button className="w-full gap-2" onClick={handleUpload}>
          <Camera className="size-4" />
          Take Photo
        </Button>
      )}
    </div>
  );
}
