import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-lg border px-2.5 py-2 text-left text-sm has-data-[slot=alert-action]:relative has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 has-data-[slot=alert-action]:pr-18 *:[svg:not([class*='size-'])]:size-4 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current",
  {
    variants: {
      variant: {
        /* ── Shadcn base variants (kept for backward compatibility) ── */
        default: "bg-card text-card-foreground",
        destructive:
          "bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current",

        /* ── Design system semantic variants ── */
        /** Amber — pending, expiring, caution */
        warning:
          "border-highlight-200 bg-highlight-50 text-highlight-800 *:data-[slot=alert-description]:text-highlight-700 *:[svg]:text-highlight-600 dark:border-highlight-500/30 dark:bg-highlight-950/50 dark:text-highlight-200 dark:*:data-[slot=alert-description]:text-highlight-300 dark:*:[svg]:text-highlight-400",
        /** Emerald — completed, verified, healthy */
        success:
          "border-success-200 bg-success-50 text-success-800 *:data-[slot=alert-description]:text-success-700 *:[svg]:text-success-600 dark:border-success-500/30 dark:bg-success-900/20 dark:text-success-200 dark:*:data-[slot=alert-description]:text-success-300 dark:*:[svg]:text-success-400",
        /** Trust Blue — informational, processing */
        info: "border-primary-200 bg-primary-50 text-primary-800 *:data-[slot=alert-description]:text-primary-700 *:[svg]:text-primary-600 dark:border-primary-500/30 dark:bg-primary-900/20 dark:text-primary-200 dark:*:data-[slot=alert-description]:text-primary-300 dark:*:[svg]:text-primary-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      className={cn(alertVariants({ variant }), className)}
      data-slot="alert"
      role="alert"
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      data-slot="alert-title"
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-balance text-muted-foreground text-sm md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className
      )}
      data-slot="alert-description"
      {...props}
    />
  );
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("absolute top-2 right-2", className)}
      data-slot="alert-action"
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, AlertAction };
