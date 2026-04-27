import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const textareaVariants = cva(
  [
    /* Layout */
    "flex w-full min-w-0 rounded-lg border bg-transparent px-2.5 py-1",
    /* Typography */
    "text-base placeholder:text-muted-foreground md:text-sm",
    /* Transitions */
    "transition-colors outline-none",
    /* Focus ring */
    "focus-visible:border-primary-500 focus-visible:ring-3 focus-visible:ring-primary-500/30",
    /* Disabled */
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50",
    /* Dark mode */
    "dark:bg-input/30 dark:disabled:bg-input/80",
    /* Resize */
    "resize-none",
  ],
  {
    variants: {
      state: {
        default: "border-input",
        error:
          "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
      },
    },
    defaultVariants: {
      state: "default",
    },
  }
);

type TextareaProps = ComponentProps<"textarea"> &
  VariantProps<typeof textareaVariants> & {
    error?: boolean;
  };

function Textarea({
  className,
  state,
  error,
  ...props
}: TextareaProps) {
  return (
    <textarea
      aria-invalid={error ? true : undefined}
      data-slot="textarea"
      className={cn(
        textareaVariants({
          state: error ? "error" : state,
        }),
        className
      )}
      {...props}
    />
  );
}

export { Textarea, textareaVariants };
