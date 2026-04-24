import { Input as InputPrimitive } from "@base-ui/react/input";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const inputVariants = cva(
  [
    /* Layout */
    "flex w-full min-w-0 rounded-lg border bg-transparent px-2.5 py-1",
    /* Typography */
    "text-base placeholder:text-muted-foreground md:text-sm",
    /* File input */
    "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
    /* Transitions */
    "transition-colors outline-none",
    /* Focus ring — uses primary-500 from design system */
    "focus-visible:border-primary-500 focus-visible:ring-3 focus-visible:ring-primary-500/30",
    /* Disabled */
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50",
    /* Dark mode */
    "dark:bg-input/30 dark:disabled:bg-input/80",
  ],
  {
    variants: {
      /**
       * inputSize — controls height to meet WCAG touch-target minimums.
       * default = h-11 (44 px) for all interactive forms.
       * sm      = h-9  (36 px) for compact/inline contexts.
       * lg      = h-12 (48 px) for hero / prominent inputs.
       */
      inputSize: {
        sm: "h-9 text-xs",
        default: "h-11",
        lg: "h-12 text-base",
      },
      /**
       * state — drives border + ring colour for validation feedback.
       * Maps to the design system's "Deterministic Feedback" principle.
       */
      state: {
        default: "border-input",
        error:
          "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
      },
    },
    defaultVariants: {
      inputSize: "default",
      state: "default",
    },
  }
);

type InputProps = ComponentProps<"input"> &
  VariantProps<typeof inputVariants> & {
    /** Convenience prop — maps to state="error" */
    error?: boolean;
  };

function Input({
  className,
  type,
  inputSize,
  state,
  error,
  ...props
}: InputProps) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        inputVariants({
          inputSize,
          state: error ? "error" : state,
        }),
        className
      )}
      {...props}
    />
  );
}

export { Input, inputVariants };
