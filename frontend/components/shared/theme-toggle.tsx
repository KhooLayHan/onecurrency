"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const THEME_CYCLE = ["system", "light", "dark"] as const;
type ThemeValue = (typeof THEME_CYCLE)[number];

type ThemeConfig = {
  Icon: typeof Monitor;
  label: string;
};

const THEME_CONFIG: Record<ThemeValue, ThemeConfig> = {
  system: { Icon: Monitor, label: "Default" },
  light: { Icon: Sun, label: "Light" },
  dark: { Icon: Moon, label: "Dark" },
};

type ThemeToggleProps = {
  /** "icon" shows label (hidden when sidebar collapses). "icon-only" is a compact icon button. */
  variant?: "icon" | "icon-only";
};

export function ThemeToggle({ variant = "icon" }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  const current = THEME_CYCLE.includes(theme as ThemeValue)
    ? (theme as ThemeValue)
    : "system";

  const nextIndex = (THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length;
  const next: ThemeValue = THEME_CYCLE[nextIndex] ?? "system";
  const { Icon, label } = THEME_CONFIG[current];

  return (
    <Button
      aria-label={`Theme: ${label}. Click to switch to ${THEME_CONFIG[next].label}`}
      className={cn(
        "gap-2",
        variant === "icon"
          ? "w-full justify-start group-data-[collapsible=icon]:justify-center"
          : "size-8 shrink-0"
      )}
      onClick={() => setTheme(next)}
      size={variant === "icon-only" ? "icon" : "sm"}
      variant="ghost"
    >
      <Icon className="size-4 shrink-0" />
      {variant === "icon" && (
        <span className="group-data-[collapsible=icon]:hidden">{label}</span>
      )}
    </Button>
  );
}
