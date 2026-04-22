"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { KycFormData } from "../kyc-verification-wizard";

// Common nationalities for the dropdown
const NATIONALITIES = [
  { value: "MY", label: "Malaysian" },
  { value: "SG", label: "Singaporean" },
  { value: "PH", label: "Filipino" },
  { value: "ID", label: "Indonesian" },
  { value: "TH", label: "Thai" },
  { value: "VN", label: "Vietnamese" },
  { value: "US", label: "American" },
  { value: "GB", label: "British" },
  { value: "AU", label: "Australian" },
  { value: "IN", label: "Indian" },
  { value: "CN", label: "Chinese" },
  { value: "JP", label: "Japanese" },
  { value: "KR", label: "Korean" },
] as const;

// Age restriction constants
const MIN_AGE_YEARS = 18;
const MAX_AGE_YEARS = 120;

type PersonalInfoStepProps = {
  formData: KycFormData;
  updateFormData: (updates: Partial<KycFormData>) => void;
};

export function PersonalInfoStep({
  formData,
  updateFormData,
}: PersonalInfoStepProps) {
  // Calculate date bounds for the calendar
  const today = new Date();
  const maxDate = new Date(
    today.getFullYear() - MIN_AGE_YEARS,
    today.getMonth(),
    today.getDate()
  );
  const minDate = new Date(
    today.getFullYear() - MAX_AGE_YEARS,
    today.getMonth(),
    today.getDate()
  );

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="fullName">Full Legal Name</FieldLabel>
        <Input
          autoComplete="name"
          id="fullName"
          onChange={(e) => updateFormData({ fullName: e.target.value })}
          placeholder="As shown on your ID"
          value={formData.fullName}
        />
        <FieldDescription>
          Enter your name exactly as it appears on your government-issued ID.
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor="dateOfBirth">Date of Birth</FieldLabel>
        <Popover>
          <PopoverTrigger
            render={
              <Button
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !formData.dateOfBirth && "text-muted-foreground"
                )}
                id="dateOfBirth"
                variant="outline"
              />
            }
          >
            <CalendarIcon className="mr-2 size-4" />
            {formData.dateOfBirth ? (
              format(formData.dateOfBirth, "PPP")
            ) : (
              <span>Select your date of birth</span>
            )}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              captionLayout="dropdown"
              defaultMonth={formData.dateOfBirth || maxDate}
              disabled={(date) => date > maxDate || date < minDate}
              endMonth={maxDate}
              mode="single"
              onSelect={(date) => updateFormData({ dateOfBirth: date })}
              selected={formData.dateOfBirth}
              startMonth={minDate}
            />
          </PopoverContent>
        </Popover>
        <FieldDescription>You must be at least 18 years old.</FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor="nationality">Nationality</FieldLabel>
        <Select
          onValueChange={(value) =>
            updateFormData({ nationality: value ?? "" })
          }
          value={formData.nationality}
        >
          <SelectTrigger className="w-full" id="nationality">
            <SelectValue placeholder="Select your nationality" />
          </SelectTrigger>
          <SelectContent>
            {NATIONALITIES.map((nationality) => (
              <SelectItem key={nationality.value} value={nationality.value}>
                {nationality.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>
          Select the country of your citizenship.
        </FieldDescription>
      </Field>
    </FieldGroup>
  );
}
