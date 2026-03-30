import { cn } from "@/lib/utils";

const AMOUNT_SIZE_CLASSES = {
  sm: { primary: "text-lg font-semibold", secondary: "text-xs" },
  md: { primary: "text-xl font-semibold", secondary: "text-sm" },
  lg: { primary: "text-2xl font-bold", secondary: "text-sm" },
  xl: {
    primary: "text-4xl font-bold tracking-tight",
    secondary: "text-base font-medium",
  },
} as const;

type AmountDisplayProps = {
  usdAmount: number;
  localCurrency?: string;
  localAmount?: number;
  size?: keyof typeof AMOUNT_SIZE_CLASSES;
  className?: string;
  align?: "left" | "center" | "right";
};

export function AmountDisplay({
  usdAmount,
  localCurrency = "RM", // Default to Malaysian Ringgit
  localAmount,
  size = "lg",
  className,
  align = "center",
}: AmountDisplayProps) {
  const classes = AMOUNT_SIZE_CLASSES[size];

  // Alignment classes mapping
  const alignClasses = {
    left: "items-start",
    center: "items-center",
    right: "items-end",
  };

  return (
    <div className={cn("flex flex-col gap-1", alignClasses[align], className)}>
      <span className={cn("text-foreground tabular-nums", classes.primary)}>
        {new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(usdAmount)}
      </span>
      {localCurrency && localAmount !== undefined && (
        <span
          className={cn(
            "text-muted-foreground tabular-nums",
            classes.secondary
          )}
        >
          ≈ {localCurrency}{" "}
          {new Intl.NumberFormat("en-MY", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(localAmount)}
        </span>
      )}
    </div>
  );
}
