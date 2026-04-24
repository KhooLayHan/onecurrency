import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  // Base — always applied
  "group/card flex flex-col gap-4 overflow-hidden rounded-xl text-card-foreground text-sm has-[>img:first-child]:pt-0 has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
  {
    variants: {
      variant: {
        /** Standard white card with a subtle ring */
        default:
          "bg-card py-4 ring-1 ring-foreground/10 has-data-[slot=card-footer]:pb-0 data-[size=sm]:gap-3 data-[size=sm]:py-3",

        /** Slightly elevated with a shadow — for hero/balance cards */
        elevated:
          "bg-card py-4 shadow-md ring-0 border border-border has-data-[slot=card-footer]:pb-0 data-[size=sm]:gap-3 data-[size=sm]:py-3",

        /** Emerald tinted — verified, completed, healthy */
        success:
          "border border-success-200 bg-success-50/20 py-4 dark:border-success-500/30 dark:bg-success-900/10 data-[size=sm]:gap-3 data-[size=sm]:py-3",

        /** Amber tinted — pending, expiring, action required */
        warning:
          "border border-highlight-200 bg-highlight-50/20 py-4 dark:border-highlight-500/30 dark:bg-highlight-950/30 data-[size=sm]:gap-3 data-[size=sm]:py-3",

        /** Trust Blue tinted — informational, in-progress */
        primary:
          "border border-primary-200 bg-primary-50/20 py-4 dark:border-primary-500/30 dark:bg-primary-900/10 data-[size=sm]:gap-3 data-[size=sm]:py-3",

        /** Red tinted — errors, rejections */
        destructive:
          "border border-destructive/30 bg-destructive/5 py-4 dark:border-destructive/20 dark:bg-destructive/10 data-[size=sm]:gap-3 data-[size=sm]:py-3",
      },
      size: {
        default: "",
        sm: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

type CardProps = React.ComponentProps<"div"> &
  VariantProps<typeof cardVariants>;

function Card({ className, variant, size, ...props }: CardProps) {
  return (
    <div
      className={cn(cardVariants({ variant, size }), className)}
      data-size={size === "sm" ? "sm" : undefined}
      data-slot="card"
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-4 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] group-data-[size=sm]/card:px-3 [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3",
        className
      )}
      data-slot="card-header"
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "font-medium text-base leading-snug group-data-[size=sm]/card:text-sm",
        className
      )}
      data-slot="card-title"
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="card-description"
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      data-slot="card-action"
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("px-4 group-data-[size=sm]/card:px-3", className)}
      data-slot="card-content"
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/card:p-3",
        className
      )}
      data-slot="card-footer"
      {...props}
    />
  );
}

export {
  Card,
  cardVariants,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
