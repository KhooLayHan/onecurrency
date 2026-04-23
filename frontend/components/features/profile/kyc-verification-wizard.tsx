"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { DocumentUploadStep } from "./kyc-steps/document-upload-step";
import { PersonalInfoStep } from "./kyc-steps/personal-info-step";
import { ReviewStep } from "./kyc-steps/review-step";
import { SelfieStep } from "./kyc-steps/selfie-step";

// Step configuration
const TOTAL_STEPS = 4;
const STEP_PERSONAL_INFO = 1;
const STEP_DOCUMENT_UPLOAD = 2;
const STEP_SELFIE = 3;
const STEP_REVIEW = 4;

// Progress percentages for each step
const PROGRESS_FULL_PERCENT = 100;
const PROGRESS_PER_STEP = PROGRESS_FULL_PERCENT / TOTAL_STEPS;

const STEP_TITLES: Record<number, string> = {
  [STEP_PERSONAL_INFO]: "Personal Information",
  [STEP_DOCUMENT_UPLOAD]: "Identity Document",
  [STEP_SELFIE]: "Photo Verification",
  [STEP_REVIEW]: "Review & Submit",
};

const STEP_DESCRIPTIONS: Record<number, string> = {
  [STEP_PERSONAL_INFO]:
    "Enter your legal name and date of birth as they appear on your ID.",
  [STEP_DOCUMENT_UPLOAD]: "Upload a clear photo of your government-issued ID.",
  [STEP_SELFIE]: "Take a photo of yourself to verify your identity.",
  [STEP_REVIEW]: "Review your information before submitting.",
};

// Form data type for all steps
export type KycFormData = {
  fullName: string;
  dateOfBirth: Date | undefined;
  nationality: string;
  documentType: string;
  documentFrontUploaded: boolean;
  documentBackUploaded: boolean;
  selfieUploaded: boolean;
};

const INITIAL_FORM_DATA: KycFormData = {
  fullName: "",
  dateOfBirth: undefined,
  nationality: "",
  documentType: "",
  documentFrontUploaded: false,
  documentBackUploaded: false,
  selfieUploaded: false,
};

type KycVerificationWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: KycFormData) => Promise<void>;
  defaultName?: string;
};

export function KycVerificationWizard({
  open,
  onOpenChange,
  onSubmit,
  defaultName = "",
}: KycVerificationWizardProps) {
  const [currentStep, setCurrentStep] = useState(STEP_PERSONAL_INFO);
  const [formData, setFormData] = useState<KycFormData>({
    ...INITIAL_FORM_DATA,
    fullName: defaultName,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const progressValue = currentStep * PROGRESS_PER_STEP;

  const updateFormData = (updates: Partial<KycFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > STEP_PERSONAL_INFO) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      // Reset wizard state on successful submit
      setCurrentStep(STEP_PERSONAL_INFO);
      setFormData({ ...INITIAL_FORM_DATA, fullName: defaultName });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelConfirm = () => {
    setShowCancelConfirm(false);
    setCurrentStep(STEP_PERSONAL_INFO);
    setFormData({ ...INITIAL_FORM_DATA, fullName: defaultName });
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && currentStep > STEP_PERSONAL_INFO) {
      // User is trying to close with progress - show confirmation
      setShowCancelConfirm(true);
    } else {
      onOpenChange(newOpen);
    }
  };

  // Validation for each step
  const isStep1Valid =
    formData.fullName.trim().length > 0 &&
    formData.dateOfBirth !== undefined &&
    formData.nationality.length > 0;

  const isStep2Valid =
    formData.documentType.length > 0 &&
    formData.documentFrontUploaded &&
    (formData.documentType === "passport" || formData.documentBackUploaded);

  const isStep3Valid = formData.selfieUploaded;

  const canProceed =
    (currentStep === STEP_PERSONAL_INFO && isStep1Valid) ||
    (currentStep === STEP_DOCUMENT_UPLOAD && isStep2Valid) ||
    (currentStep === STEP_SELFIE && isStep3Valid) ||
    currentStep === STEP_REVIEW;

  return (
    <>
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent
          className="sm:max-w-md"
          showCloseButton={currentStep === STEP_PERSONAL_INFO}
        >
          <DialogHeader>
            <div className="mb-2">
              <Progress value={progressValue} />
            </div>
            <DialogTitle>{STEP_TITLES[currentStep]}</DialogTitle>
            <DialogDescription>
              {STEP_DESCRIPTIONS[currentStep]}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {currentStep === STEP_PERSONAL_INFO && (
              <PersonalInfoStep
                formData={formData}
                updateFormData={updateFormData}
              />
            )}
            {currentStep === STEP_DOCUMENT_UPLOAD && (
              <DocumentUploadStep
                formData={formData}
                updateFormData={updateFormData}
              />
            )}
            {currentStep === STEP_SELFIE && (
              <SelfieStep formData={formData} updateFormData={updateFormData} />
            )}
            {currentStep === STEP_REVIEW && <ReviewStep formData={formData} />}
          </div>

          <div className="flex gap-2 pt-2">
            {currentStep > STEP_PERSONAL_INFO && (
              <Button
                disabled={isSubmitting}
                onClick={handleBack}
                variant="outline"
              >
                Back
              </Button>
            )}
            <div className="flex-1" />
            {currentStep < TOTAL_STEPS ? (
              <Button disabled={!canProceed} onClick={handleNext}>
                Continue
              </Button>
            ) : (
              <Button disabled={isSubmitting} onClick={handleSubmit}>
                {isSubmitting ? "Submitting..." : "Submit Verification"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation dialog */}
      <AlertDialog onOpenChange={setShowCancelConfirm} open={showCancelConfirm}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Verification?</AlertDialogTitle>
            <AlertDialogDescription>
              Your progress will be lost. Are you sure you want to cancel the
              verification process?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Verification</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              variant="destructive"
            >
              Yes, Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
