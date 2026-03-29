# OneCurrency Design System

> **Version:** 1.0 — FYP MVP  
> **Stack:** Next.js 16 · React 19 · Tailwind CSS v4 · shadcn/ui · Framer Motion  
> **Audience:** Retail & SME users (Web2 / E-wallet experience — no crypto knowledge assumed)

---

## 🎨 Quick Reference

### Color System (60-30-10 Rule)

| Role     | %   | Palette               | Semantic Token                                                          |
| -------- | --- | --------------------- | ----------------------------------------------------------------------- |
| Neutrals | 60% | Cool Slate            | `--color-background`, `--color-muted`, `--color-card`, `--color-border` |
| Primary  | 30% | Trust Blue            | `--color-primary` (and scale `50`→`700`)                                |
| Accents  | 10% | Emerald · Amber · Red | `--color-success-*`, `--color-highlight-*`, `--color-destructive`       |

**OKLCH palette (defined in `app/globals.css` via `@theme`):**

```css
/* 60% — Neutrals */
--color-background: oklch(1 0 0);
--color-muted: oklch(0.97 0.002 260);
--color-card: oklch(1 0 0);
--color-border: oklch(0.9 0.005 260);
--color-foreground: oklch(0.15 0.01 260);
--color-muted-foreground: oklch(0.45 0.01 260);

/* 30% — Primary Blue */
--color-primary-50: oklch(0.97 0.02 255);
--color-primary-100: oklch(0.93 0.04 255);
--color-primary-500: oklch(0.62 0.17 255);
--color-primary-600: oklch(0.55 0.19 255); /* default primary */
--color-primary-700: oklch(0.48 0.2 255);

/* 10% — Accents */
--color-success-50: oklch(0.97 0.03 155);
--color-success-500: oklch(0.65 0.18 155);
--color-success-600: oklch(0.58 0.2 155);
--color-highlight-50: oklch(0.97 0.04 80);
--color-highlight-500: oklch(0.72 0.17 80);
--color-highlight-600: oklch(0.65 0.19 80);
--color-destructive: oklch(0.58 0.22 25);

/* Dark mode overrides (applied on .dark class) */
--color-background-dark: oklch(
  0.15 0.02 260
); /* #0f172a — rich, not pure black */
--color-muted-dark: oklch(0.25 0.02 260); /* #1e293b */
--color-card-dark: oklch(0.25 0.02 260);
--color-border-dark: oklch(0.35 0.02 260);
--color-foreground-dark: oklch(0.97 0.01 260);
--color-muted-foreground-dark: oklch(0.65 0.01 260);
```

> Colours are mapped to Tailwind utility classes via `@theme` (e.g. `bg-primary-600`,
> `text-success-500`). Do **not** hardcode hex values in components.

---

### Typography

**Font family:** Geist (Vercel, sans-serif). Loaded via `next/font/google`.

| Token       | Size | Line-height | Usage                                    |
| ----------- | ---- | ----------- | ---------------------------------------- |
| `text-xs`   | 12px | 16px        | Captions, timestamps, badge labels       |
| `text-sm`   | 14px | 20px        | Form labels, secondary info, button text |
| `text-base` | 16px | 24px        | Body copy, input values                  |
| `text-lg`   | 18px | 28px        | Card headings                            |
| `text-xl`   | 20px | 28px        | Section titles                           |
| `text-2xl`  | 24px | 32px        | Page titles                              |
| `text-3xl`  | 30px | 36px        | Hero balance amounts                     |

**Weights used:**

- `font-normal` (400) — body copy
- `font-medium` (500) — labels, secondary headings
- `font-semibold` (600) — card headers, table column headers
- `font-bold` (700) — page titles, hero amounts

**Tabular figures** — mandatory for all monetary values to prevent layout shift:

```html
<span class="tabular-nums">$1,240.00</span>
```

---

### Spacing

| Usage                     | Class                  | Value          |
| ------------------------- | ---------------------- | -------------- |
| Page horizontal padding   | `px-4 sm:px-6 lg:px-8` | 16 → 24 → 32px |
| Card padding              | `p-4 sm:p-6`           | 16 → 24px      |
| Section vertical gap      | `gap-6`                | 24px           |
| Element gap (within card) | `gap-4`                | 16px           |
| Tight element gap         | `gap-2`                | 8px            |

**Touch target minimum:** `h-11` (44px) on mobile, `h-10` (40px) acceptable on desktop.

---

### Breakpoints

| Name        | Min-width | Usage                                   |
| ----------- | --------- | --------------------------------------- |
| _(default)_ | —         | Mobile: single column, full-width cards |
| `sm`        | 640px     | 2-column grids start, wider padding     |
| `md`        | 768px     | Enhanced layouts, side-by-side actions  |
| `lg`        | 1024px    | Full dashboard, wider containers        |
| `xl`        | 1280px    | Max-width content containers            |

---

## 🧠 Design Principles

### 1. Familiarity over Novelty (The Web2 Cloak)

Aggressively abstract all blockchain complexity. The user is an e-wallet user, not a
crypto enthusiast. Every piece of copy must feel like it belongs in a banking app.

**Terminology dictionary:**

| Backend / Web3 Reality     | ✅ Frontend UI copy                   | Psychology                                                   |
| -------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| Wallet / Address           | **Account** / **OneCurrency Balance** | "Wallet" sounds like MetaMask. "Account" sounds like a bank. |
| Deposit / Fiat On-Ramp     | **Add Money** / **Top Up**            | Familiar to Southeast Asian e-wallet users (TNG, GrabPay).   |
| Withdraw / Burn            | **Cash Out** / **Send to Bank**       | Clear, action-oriented.                                      |
| Transaction Hash / Tx      | **Receipt Reference**                 | Sounds auditable and trustworthy.                            |
| Gas Fee / Network Fee      | **Processing Fee**                    | Standard e-commerce terminology.                             |
| Minting Tokens             | **Processing your funds…**            | Hides blockchain complexity entirely.                        |
| Smart Contract             | _(Never mention)_                     | It is infrastructure, not a user feature.                    |
| Blockchain / Web3 / Crypto | _(Never mention)_                     | Same reason.                                                 |

### 2. Low Floor, High Ceiling

- **Low Floor:** The core flow (Add Money → view Balance → Cash Out) must be achievable
  in under three taps for a first-time user.
- **High Ceiling:** Advanced features (managed recovery, KYC details, transaction export)
  exist but are tucked behind secondary menus. They do not clutter the main experience.
- **Progressive Disclosure:** Surface complexity only when the user explicitly asks for it.

### 3. Deterministic Feedback

Financial apps cause anxiety. Every action must produce an immediate, unambiguous response.

| Trigger       | Required Feedback                                  |
| ------------- | -------------------------------------------------- |
| Button click  | Loading state within 100ms                         |
| API success   | Toast notification + UI state update               |
| API error     | Inline error message + toast                       |
| Data loading  | Skeleton loaders (never blank screens)             |
| Status change | Badge updates instantly (optimistic UI where safe) |
| KYC verified  | Immediate green badge + unlocked actions           |

---

## 🎯 Component Patterns

All components use **`cva`** (Class Variance Authority) for variant management and
**`clsx`** (via the `cn()` helper) for conditional class merging. This pattern keeps
variant logic declarative, type-safe, and compatible with Storybook controls.

### `cn()` Helper

Lives in `lib/utils.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

### Button

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base styles — always applied
  [
    "inline-flex items-center justify-center gap-2",
    "rounded-lg font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800",
        secondary:
          "border border-border bg-transparent hover:bg-muted active:bg-muted/80",
        ghost: "hover:bg-muted active:bg-muted/80",
        danger: "bg-destructive text-white hover:opacity-90",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        default: "h-11 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
```

---

### Input

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  [
    "flex w-full rounded-lg border bg-transparent px-3 py-2 text-sm",
    "placeholder:text-muted-foreground",
    "transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent",
    "disabled:cursor-not-allowed disabled:opacity-50",
  ],
  {
    variants: {
      inputSize: {
        default: "h-11",
        sm: "h-9 text-xs",
        lg: "h-12 text-base",
      },
      state: {
        default: "border-border",
        error: "border-destructive focus-visible:ring-destructive",
      },
    },
    defaultVariants: {
      inputSize: "default",
      state: "default",
    },
  },
);

type InputProps = React.ComponentProps<"input"> &
  VariantProps<typeof inputVariants> & {
    error?: boolean;
  };

export function Input({ className, inputSize, error, ...props }: InputProps) {
  return (
    <input
      className={cn(
        inputVariants({ inputSize, state: error ? "error" : "default" }),
        className,
      )}
      {...props}
    />
  );
}
```

---

### Badge (Status Indicator)

```tsx
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        success: "bg-success-50 text-success-600",
        warning: "bg-highlight-50 text-highlight-600",
        error: "bg-red-50 text-destructive",
        neutral: "bg-muted text-muted-foreground",
        primary: "bg-primary-50 text-primary-600",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
```

Usage examples:

```tsx
<Badge variant="success">Completed</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="error">Failed</Badge>
<Badge variant="primary">Action Required</Badge>
```

---

### Money Display Pattern

USD is always the **Source of Truth** — shown large and prominent. Local currency is
secondary, smaller, and prefixed with `≈`.

```tsx
const AMOUNT_SIZE_CLASSES = {
  sm: { primary: "text-lg font-semibold", secondary: "text-xs" },
  md: { primary: "text-xl font-semibold", secondary: "text-sm" },
  lg: { primary: "text-2xl font-bold", secondary: "text-sm" },
  xl: { primary: "text-3xl font-bold", secondary: "text-base" },
} as const;

type AmountDisplayProps = {
  usdAmount: number;
  localCurrency?: string;
  localAmount?: number;
  size?: keyof typeof AMOUNT_SIZE_CLASSES;
  className?: string;
};

export function AmountDisplay({
  usdAmount,
  localCurrency,
  localAmount,
  size = "lg",
  className,
}: AmountDisplayProps) {
  const classes = AMOUNT_SIZE_CLASSES[size];

  return (
    <div className={cn("flex flex-col items-center gap-0.5", className)}>
      <span className={cn("tabular-nums tracking-tight", classes.primary)}>
        {new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(usdAmount)}
      </span>
      {localCurrency && localAmount !== undefined && (
        <span
          className={cn(
            "tabular-nums text-muted-foreground",
            classes.secondary,
          )}
        >
          ≈ {localCurrency} {new Intl.NumberFormat("en-MY").format(localAmount)}
        </span>
      )}
    </div>
  );
}
```

---

### Bottom Tab Bar (Mandatory — All Screen Sizes)

4 tabs, fixed to the bottom. Lucide icons: **outline** by default, **filled** when active.

```tsx
// constants defined at top of file — no magic numbers
const TAB_BAR_HEIGHT_PX = 64;
const TAB_ICON_SIZE_PX = 20;

const TABS = [
  { id: "home", label: "Home", href: "/dashboard", Icon: Home },
  {
    id: "transfer",
    label: "Transfer",
    href: "/transfer",
    Icon: ArrowLeftRight,
  },
  { id: "history", label: "History", href: "/history", Icon: Receipt },
  { id: "profile", label: "Profile", href: "/profile", Icon: User },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/80 backdrop-blur-lg"
      style={{ height: TAB_BAR_HEIGHT_PX }}
    >
      <div className="mx-auto flex h-full max-w-lg items-center justify-around px-2">
        {TABS.map(({ id, label, href, Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={id}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-w-[44px] flex-col items-center gap-1 rounded-lg px-3 py-2 transition-colors",
                isActive
                  ? "text-primary-600"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon
                size={TAB_ICON_SIZE_PX}
                fill={isActive ? "currentColor" : "none"}
                aria-hidden="true"
              />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

---

## 🛠️ Development Guidelines

### Type vs Interface

**Always prefer `type`** unless a specific interface feature is required.

```ts
// ✅ Good — type for props
type CardProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
};

// ✅ Good — type for API shapes
type TransactionResponse = {
  id: string;
  receiptReference: string;
  usdAmount: number;
  status: "completed" | "pending" | "failed";
};

// ✅ Good — discriminated union
type KycStatus =
  | { state: "verified" }
  | { state: "pending"; submittedAt: Date }
  | { state: "unverified" };

// ⚠️ Use interface only when class implements it or declaration merging is needed
interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}
```

### Avoid Magic Numbers

Define named constants — use `UPPER_SNAKE_CASE`, include units in the name.

```ts
// ❌ Bad
setTimeout(() => closeModal(), 2000);
const perPage = 10;

// ✅ Good
const KYC_SIMULATION_DELAY_MS = 2_000;
const ITEMS_PER_PAGE_MOBILE = 10;
const ITEMS_PER_PAGE_DESKTOP = 20;
const TOUCH_TARGET_MIN_PX = 44;
const ANIMATION_DURATION_MS = 200;
const ANIMATION_SPRING_STIFFNESS = 300;
const ANIMATION_SPRING_DAMPING = 30;
```

Place constants at the top of the file they belong to, or in a `constants/` file
when shared across multiple components.

### File & Folder Naming

| Type              | Convention                     | Example                    |
| ----------------- | ------------------------------ | -------------------------- |
| Components        | PascalCase                     | `BalanceCard.tsx`          |
| Utilities / hooks | kebab-case                     | `use-kyc-status.ts`        |
| Constants files   | kebab-case                     | `transaction-constants.ts` |
| Stories           | Same as component + `.stories` | `BalanceCard.stories.tsx`  |
| Types             | PascalCase                     | `TransactionTypes.ts`      |

### Import Order

Biome/Ultracite enforces this automatically via `organizeImports`:

1. External packages (`react`, `next`, `framer-motion`, …)
2. Internal absolute (`@/components/…`, `@/lib/…`)
3. Internal relative (`../utils`, `./helpers`)

### Named Exports Only

Avoid default exports. This improves tree-shaking and IDE auto-imports.

```ts
// ✅ Good
export function Button(...) {}
export const buttonVariants = cva(...)

// ❌ Avoid
export default function Button(...) {}
```

---

## ♿ Accessibility

### Biome / Ultracite

The root `biome.jsonc` extends `ultracite` which bundles recommended a11y rules. Linting
runs on:

```bash
frontend/app/**/*
frontend/components/**
frontend/hooks/**
frontend/lib/**
```

Storybook files are explicitly excluded from linting (`.storybook/**`, `stories/**`).

### WCAG AA — Key Requirements

| Rule            | Implementation                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| Semantic HTML   | Use `<button>`, `<nav>`, `<main>`, `<section>`, not `<div onClick>`                                           |
| Colour contrast | 4.5 : 1 minimum (OKLCH palette is calibrated for this)                                                        |
| Focus states    | `focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2` on all interactive elements |
| Touch targets   | `h-11` minimum (44px), spacing between targets ≥ 8px                                                          |
| ARIA labels     | Icon-only buttons must have `aria-label`; decorative icons get `aria-hidden="true"`                           |
| Screen readers  | Dynamic content updates (toasts, balance changes) announced via `role="alert"` or `aria-live`                 |
| Keyboard nav    | All interactive elements reachable via Tab; modals trap focus                                                 |

### Forms

```tsx
{/* Always pair label with input */}
<label htmlFor="email" className="text-sm font-medium">
  Email
</label>
<input
  id="email"
  type="email"
  autoComplete="email"
  aria-describedby={error ? "email-error" : undefined}
/>
{error && (
  <span id="email-error" role="alert" className="text-xs text-destructive">
    {error}
  </span>
)}
```

### Preflight Overrides

Tailwind Preflight is enabled (default in v4). Document any required overrides here as
the project evolves — e.g. custom form element resets, `font-variant-numeric` globals.

---

## 📱 Responsive Strategy

### Mobile-First

Start with mobile styles, use breakpoint prefixes (`sm:`, `md:`, `lg:`) to enhance:

```html
<!-- Single column on mobile, 2-column on sm+ -->
<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
  <!-- Full-width button on mobile, auto-width on sm+ -->
  <button class="w-full sm:w-auto">Add Money</button>
</div>
```

### Layout Patterns by Breakpoint

| Screen              | Layout                 | Navigation                           |
| ------------------- | ---------------------- | ------------------------------------ |
| < 640px (mobile)    | Single column, stacked | Bottom tab bar                       |
| 640–1023px (tablet) | 2-column stat cards    | Bottom tab bar                       |
| ≥ 1024px (desktop)  | 2–3 column dashboard   | Bottom tab bar + optional left panel |

**Bottom tab bar is mandatory on all screen sizes.**  
Desktop may add a left sidebar for quick stats, but the bottom bar always persists.

### Safe Area Insets

For devices with home indicators (iPhone X+):

```html
<nav class="pb-safe">...</nav>
```

Configure `safe` spacing in `globals.css` via `env(safe-area-inset-bottom)` if not
handled by the framework.

### Currency Display (Responsive)

```tsx
<div className="flex flex-col items-center">
  {/* USD — Source of Truth */}
  <span className="text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
    $1,240.00
  </span>
  {/* Local currency — secondary */}
  <span className="text-sm tabular-nums text-muted-foreground sm:text-base">
    ≈ RM 5,850.00
  </span>
</div>
```

---

## 🎬 Animation Guidelines

### Principles

- Framer Motion is for **micro-interactions only** — it is a supporting tool, not a
  design statement.
- Keep durations within `150–300ms`. Slower feels unresponsive; faster is imperceptible.
- Never animate elements that convey critical financial state without also updating the
  underlying value.
- Always respect `prefers-reduced-motion`.

### Approved Micro-interactions

| Use Case              | Animation                            | Duration       |
| --------------------- | ------------------------------------ | -------------- |
| Balance number ticker | `AnimatedNumber` (counter animation) | 600ms ease-out |
| Skeleton loaders      | CSS shimmer (`animate-pulse`)        | Continuous     |
| Modal / dialog open   | Fade + scale (0.95 → 1)              | 200ms ease-out |
| Tab switch            | Slide + fade                         | 150ms          |
| Button press          | Scale 0.98                           | 100ms spring   |
| Page transition       | Fade (opacity 0 → 1)                 | 150ms ease-out |
| Toast notification    | Slide in from top                    | 200ms spring   |

### Code Pattern

```tsx
import { motion, useReducedMotion } from "framer-motion";

const FADE_UP_VARIANTS = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

const ANIMATION_DURATION_MS = 200;

export function FadeIn({ children }: { children: React.ReactNode }) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) return <>{children}</>;

  return (
    <motion.div
      variants={FADE_UP_VARIANTS}
      initial="hidden"
      animate="visible"
      transition={{ duration: ANIMATION_DURATION_MS / 1000, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
```

### Never Use

- Parallax scrolling
- Heavy particle / confetti effects on financial data screens
- Bouncy / elastic spring animations on serious state (errors, transaction failures)
- Animations that block or delay user interaction

---

## 📚 Storybook Guidelines (MVP-Lightweight)

### Colocation

Place `.stories.tsx` files **next to** the component they document:

```bash
components/
└── ui/
    ├── button.tsx
    ├── button.stories.tsx    ← colocated
    ├── badge.tsx
    └── badge.stories.tsx     ← colocated
```

The Storybook `main.ts` config includes both `stories/` (legacy) and
`components/**/*.stories.*` (colocated) glob patterns.

### Minimal Story Structure

```tsx
// button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  component: Button,
  title: "UI/Button",
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "ghost", "danger"],
    },
    size: {
      control: "select",
      options: ["sm", "default", "lg", "icon"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// One story per meaningful state
export const Primary: Story = {
  args: { children: "Add Money", variant: "primary" },
};

export const Secondary: Story = {
  args: { children: "Cancel", variant: "secondary" },
};

export const Danger: Story = {
  args: { children: "Remove Account", variant: "danger" },
};

export const Disabled: Story = {
  args: { children: "Processing…", disabled: true },
};
```

### Configuration Notes

- **`tags: ["autodocs"]`** — generates automatic props documentation page
- **`@storybook/addon-a11y`** — already installed; flags WCAG violations in the
  Accessibility panel. Run this check before shipping any new component.
- **`@storybook/addon-vitest`** — already installed; stories can serve as snapshot
  / interaction tests with Vitest.

### Essential References

- [Writing Stories](https://storybook.js.org/docs/writing-stories)
- [Writing Docs](https://storybook.js.org/docs/writing-docs)
- [Storybook Essentials](https://storybook.js.org/docs/essentials)
- [API Reference](https://storybook.js.org/docs/api)

---

## 🔮 Future Considerations

### Progressive Web App (PWA)

**Why relevant for FYP MVP:**
Delivering a PWA would allow users to add OneCurrency to their Home Screen, get offline
balance caching, and receive push notifications for transaction status — all without an
app store submission. This significantly closes the gap between the web product and a
native e-wallet.

**Implementation Path:**

1. Add `public/manifest.json` with app metadata (name, icons, theme colour)
2. Configure a service worker (Next.js supports this via `next-pwa` or the native
   `app/sw.ts` approach in Next 15+)
3. Cache the dashboard and last-known balance for offline reading
4. Add `<link rel="manifest">` to `layout.tsx`

**Trade-offs:**

| Pro                                  | Con                                     |
| ------------------------------------ | --------------------------------------- |
| Native app feel, Home Screen install | Caching strategy adds complexity        |
| Offline balance / history viewing    | Requires HTTPS in production            |
| Push notifications for transactions  | Service worker debugging is non-trivial |

**Recommendation:** Implement post-MVP or as a stretch goal if time permits. The
foundation (Tailwind, React, mobile-first layout) already supports PWA without
architectural changes.

---

## 🔗 Resources & References

### Class Variance Authority (CVA)

- [Variants](https://cva.style/docs/getting-started/variants)
- [TypeScript](https://cva.style/docs/getting-started/typescript)
- [Extending Components](https://cva.style/docs/getting-started/extending-components)
- [Composing Components](https://cva.style/docs/getting-started/composing-components)

### Tailwind CSS v4

- [Theme Variables](https://tailwindcss.com/docs/theme)
- [Styling with Utility Classes](https://tailwindcss.com/docs/styling-with-utility-classes)
- [Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [Hover, Focus, and Other States](https://tailwindcss.com/docs/hover-focus-and-other-states)

### shadcn/ui

- [Component Docs](https://ui.shadcn.com/docs)
- [Tailwind v4 Guide](https://ui.shadcn.com/docs/tailwind-v4)
- [Dark Mode — Next.js](https://ui.shadcn.com/docs/dark-mode/next)
- Local LLM reference: `docs/shadcn/llms.txt`

### Storybook

- [Writing Stories](https://storybook.js.org/docs/writing-stories)
- [Writing Docs](https://storybook.js.org/docs/writing-docs)
- [Storybook Essentials](https://storybook.js.org/docs/essentials)
- [API Reference](https://storybook.js.org/docs/api)

### Accessibility

- [WCAG 2.1 AA Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [Biome Accessibility Rules](https://biomejs.dev/linter/rules/#accessibility)

---

## 📝 Changelog

| Version | Date    | Notes                                         |
| ------- | ------- | --------------------------------------------- |
| 1.0     | 2026-03 | Initial design system for OneCurrency FYP MVP |
