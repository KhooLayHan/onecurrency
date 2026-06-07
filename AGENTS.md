# Agent Guidelines for OneCurrency

## Workspace Structure

- **Root**: pnpm 10 + Turborepo monorepo. Root lockfile is `pnpm-lock.yaml`.
- **`frontend/`**: Next.js 16 app using App Router and Turbopack. Entry point is `frontend/app/page.tsx` (redirects to `/login`). `frontend/app/layout.tsx` is the root layout.
- **`backend/`**: Hono 4 API server running on Bun runtime. Entry point is `backend/src/index.ts`.
- **`contracts/`**: Hardhat 3 with Solidity 0.8.28. Has its own separate `pnpm-lock.yaml`.
- **`packages/common/`**: Shared package `@onecurrency/common`. Exports Zod schemas, amount/limit constants, and validation utilities. Compiled with `tsc --build` (composite package, outputs to `dist/`).
- **Path aliases**: All workspaces use `@/common/*` to import from `packages/common/src/*`. Frontend additionally uses `@/src/*` to import from `backend/src/*` (for the `AppRouter` type).

## Commands

### Root-level (Turborepo)

- `pnpm dev` — Starts all dev servers in parallel (frontend Next.js Turbopack + backend Bun hot reload).
- `pnpm build` — Builds all packages (depends on upstream builds first).
- `pnpm lint` — Runs lint across all workspaces via Turbo.
- `pnpm test` — Turbo task that only runs package `test` scripts. Does NOT run backend tests (none configured) or contract tests.
- `pnpm format` — Biome format --write on entire repo.
- `pnpm format:check` — Biome format check (read-only).

### Frontend (Next.js 16 + Turbopack)

- `cd frontend && pnpm dev` — Starts Next.js dev server with Turbopack.
- `cd frontend && pnpm test` — Runs Vitest unit tests (jsdom environment).
- `cd frontend && pnpm test:browser` — Runs Vitest browser tests (Playwright/Chromium).
- `cd frontend && pnpm test -- src/path/to.test.tsx` — Targets a single test file.
- `cd frontend && pnpm storybook` — Starts Storybook dev server on port 6006.
- `cd frontend && pnpm lint` — Biome lint.
- `cd frontend && pnpm format` — Biome format --write.

### Backend (Hono 4 + Bun)

- `cd backend && pnpm dev` — Bun hot reload (`bun run --hot src/index.ts`).
- `cd backend && pnpm db:generate` — Generates Drizzle migration files.
- `cd backend && pnpm db:migrate` — Runs migrations (requires `DB_MIGRATION=true`).
- `cd backend && pnpm db:seed` — Seeds database (requires `DB_SEEDING=true`).
- `cd backend && pnpm db:studio` — Opens Drizzle Studio GUI.
- `cd backend && pnpm db:push` — Pushes schema changes directly.
- `cd backend && pnpm db:prod:generate` / `db:prod:migrate` / `db:prod:seed` — Production variants using `.env.production`.
- **No test runner configured yet.** `backend/tests/` directory exists but is empty.

### Contracts (Hardhat 3)

- `cd contracts && pnpm hh:build` — Compiles Solidity contracts.
- `cd contracts && pnpm hh:test` — Runs contract tests (Hardhat/Chai).
- `cd contracts && pnpm hh:node` — Starts local Hardhat node.
- `cd contracts && pnpm hh:deploy` — Deploys to localhost.
- `cd contracts && pnpm hh:prod-deploy` — Deploys to Sepolia testnet.
- Focused test runs: `cd contracts && npx hardhat test test/Counter.ts` or `npx hardhat test --grep "pattern"`.

## CI Pipeline

- Triggers on push/PR to `main`.
- Order: `format:check` → `lint` → `test` → `build`.
- Uses Node.js 24, pnpm cache on `pnpm-lock.yaml`.
- `pnpm install --frozen-lockfile` is used in CI.

## Pre-commit (Husky)

- `/.husky/pre-commit` runs `pnpm dlx ultracite fix` on staged files.
- Stashes unstaged changes, runs formatter, re-stages formatted files, pops stash.
- Commit is blocked if formatting fails.
- To manually fix: `pnpm dlx ultracite fix` or `pnpm format`.

## Code Style

- **Biome 2.2.5** with `ultracite` preset (`biome.jsonc`).
- **Formatter**: 2-space indent, double quotes, LF line endings, 80-char line width, bracket spacing.
- **Linter**: Recommended rules + Next.js domain rules + React domain rules. `noUnknownAtRules` and `noUnresolvedImports` are off.
- **Assist**: `organizeImports` on, `useSortedAttributes` on, `useSortedKeys` off.
- **Exclusions**: `frontend/components/ui/` (shadcn generated, do not hand-edit), `node_modules`, `.next`, `dist`, `build`, DB migrations, Storybook files.
- VSCode settings enforce Biome as default formatter with `formatOnSave` and `source.fixAll.biome`.

## Frontend Architecture

- **Framework**: Next.js 16 with App Router. Root page (`app/page.tsx`) redirects to `/login`.
- **Build tool**: Turbopack (`next dev --turbopack`, `next build --turbopack`).
- **Styling**: Tailwind CSS 4 with `@tailwindcss/postcss`.
- **UI Components**: shadcn/ui using `base-nova` style, CSS variables, neutral base color, Lucide icons. Config in `frontend/components.json`.
- **State**: Zustand for global state, TanStack Query 5 for server state.
- **Forms**: TanStack Form + Zod 4 validation.
- **Tables**: TanStack Table.
- **Blockchain**: Wagmi 3 + Viem 2 + Reown AppKit (WalletConnect).
- **Auth**: better-auth client (`frontend/lib/auth-client.ts`) — email/password + Google OAuth + 2FA.
- **API Client**: oRPC client (`frontend/lib/api.ts`) typed from backend `AppRouter`. Imports type directly from `../../backend/src/orpc/router`.
- **Providers**: React Query, Wagmi, Theme providers in `frontend/components/providers.tsx`.
- **Env**: Validated with `@t3-oss/env-nextjs` (`frontend/env.ts`). Validation is skipped in CI (`skipValidation: !!process.env.CI`).

## Backend Architecture

- **Framework**: Hono 4 on Bun runtime.
- **Entry point**: `backend/src/index.ts`.
- **API Style**: oRPC (typed RPC), not REST. All API calls go through `RPCHandler` mounted at `/api/v1`.
- **Router**: `backend/src/orpc/router.ts` assembles all procedures. Namespaces: `deposits`, `users`, `withdrawals`, `transfers`, `admin.kyc`, `admin.blacklist`, `admin.transactions`, `admin.users`, `admin.metrics`, `admin.auditLogs`.
- **Auth**: better-auth 1.6 server (`backend/src/auth.ts`). Sessions injected into Hono context via middleware before oRPC procedures run.
- **Database**: Drizzle ORM 1.0-beta on Neon PostgreSQL serverless.
- **Schema**: 22 schema files in `backend/src/db/schema/`. Dual ID strategy: `BIGINT` internal IDs + `UUID v7` public IDs. Financial tables are append-only.
- **Migrations**: Output to `backend/src/db/migrations/dev` locally, `prod` in production (controlled by `NODE_ENV` in `drizzle.config.ts`).
- **Seeding**: `backend/src/seeding.ts` with Faker.js factories.
- **Services**: Business logic in `backend/src/services/` (audit, blacklist, deposit, KYC, R2, Stripe, transfer, user, wallet, withdrawal, blockchain relayer).
- **Repositories**: Data access layer in `backend/src/repositories/`.
- **Raw Routes**: Stripe webhooks at `backend/src/routes/deposits/` bypass oRPC because signature verification requires the raw, unconsumed request body.
- **Email**: Resend integration with react-email templates in `backend/src/emails/`.
- **Storage**: Cloudflare R2 for KYC document storage (`backend/src/services/r2.service.ts`).
- **Logging**: Pino 10 structured logger + pino-http. BetterStack integration via Vector sidecar in Docker.
- **Env**: Validated with `@t3-oss/env-core` (`backend/src/env.ts`).

## Smart Contracts

- **Framework**: Hardhat 3 Beta with `@nomicfoundation/hardhat-toolbox-viem`.
- **Main Contract**: `contracts/contracts/OneCurrency.sol` — ERC20 stablecoin.
  - Features: `ERC20Burnable`, `ERC20Pausable`, `ERC20Permit` (EIP-2612), `AccessControl`.
  - Roles: `MINTER_ROLE`, `PAUSER_ROLE`, `BLACKLIST_ROLE`, `SEIZE_ROLE`.
  - Hard `MAX_SUPPLY` cap (immutable).
  - Compliance blacklist blocks send/receive.
  - `seizeTokens()` bypasses blacklist for regulatory seizure (uses `_seizing` guard in `_update`).
  - Emergency `pause()` / `unpause()` circuit breaker.
- **Deployment**: Hardhat Ignition modules in `contracts/ignition/`. Sepolia deployment artifacts in `contracts/ignition/deployments/chain-11155111/`.
- **Networks**: `node` (EDR simulated), `hardhatMainnet`, `hardhatOp`, `sepolia` (requires `SEPOLIA_RPC_URL` + `SEPOLIA_PRIVATE_KEY`).

## Database Design

- **Dual ID Strategy**: Internal `BIGINT` IDs for foreign keys + `UUID v7` public IDs exposed in APIs.
- **Append-Only Financial Tables**: Deposits, withdrawals, transfers, blockchain transactions are immutable (no updates, only inserts).
- **Schema Files**: 22 files in `backend/src/db/schema/` covering: auth tables, RBAC, KYC, wallets, deposits, blockchain transactions, audit logs, blacklist, webhook events, transfers, withdrawals, KYC submissions, rate limits, 2FA.
- **Triggers**: PostgreSQL triggers for audit logging and `updated_at` management.
- **Migration Runner**: `backend/src/migration.ts` with `DB_MIGRATION=true` env flag.
- **Seed Runner**: `backend/src/seeding.ts` with `DB_SEEDING=true` env flag.

## TypeScript Configuration

- **Base**: `tsconfig.base.json` at root. Shared settings: `target: es2022`, `module: esnext`, `strict: true`, `verbatimModuleSyntax: true`, `noUncheckedIndexedAccess: true`.
- **Frontend**: Extends base. Adds `dom` libs, `moduleResolution: bundler`, Next.js plugin. Paths: `@/*` → `./*`, `@/common/*` → `../packages/common/src/*`, `@/src/*` → `../backend/src/*`.
- **Backend**: Extends base. `moduleResolution: bundler`, `jsxImportSource: hono/jsx`, `noEmit: false`, `outDir: dist`. Paths: `@/*` → `./*`, `@/common/*` → `../packages/common/src/*`.
- **Contracts**: Extends base. Covers `hardhat.config.ts`, `scripts/**`, `test/**`. Paths: `@/*` → `./*`, `@/common/*` → `../packages/common/src/*`.
- **Packages/Common**: Extends base. `composite: true`, `declaration: true`, `outDir: dist`, `rootDir: src`.

## Environment Variables

### Root `.env.example` (incomplete — copy and extend)

- Variables listed in `.env.example` are NOT exhaustive.

### Backend Required (`backend/src/env.ts`)

- `NODE_ENV`: development | testing | staging | production (default: development)
- `API_PORT`: Server port (default: 3030)
- `DATABASE_URL`: Neon PostgreSQL connection string (with pooling)
- `DIRECT_DATABASE_URL`: Direct Neon connection string (for migrations)
- `DB_SEEDING`: Boolean flag to trigger seeding at startup (default: false)
- `DB_MIGRATION`: Boolean flag to trigger migrations at startup (default: false)
- `BETTER_AUTH_SECRET`: Session secret (min 1 char)
- `BETTER_AUTH_URL`: Auth server URL
- `MASTER_ENCRYPTION_KEY`: AES key for custodial wallet encryption (hex 64 chars, optional)
- `ADMIN_SECRET`: Optional admin bypass secret
- `LOCAL_RPC_URL`: Local blockchain RPC URL
- `SEPOLIA_RPC_URL`: Sepolia RPC (optional in dev, required for prod deploy)
- `SEPOLIA_PRIVATE_KEY`: Sepolia deployer key (hex 64 chars, optional in dev)
- `ONECURRENCY_ADDRESS`: Deployed OneCurrency contract address (hex 40 chars)
- `TREASURY_ADDRESS`: Treasury wallet address (optional)
- `ETHERSCAN_API_KEY`: For contract verification (optional)
- `STRIPE_SECRET_KEY`: Regex `^sk_(test|live)_`
- `STRIPE_PUBLISHABLE_KEY`: Regex `^pk_(test|live)_` (NOT in `.env.example`)
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret
- `LOCAL_CORS_ORIGIN`: Default `https://localhost:3000`
- `PROD_CORS_ORIGIN`: Default `https://www.onecurrency.tech`
- `PROD_SUB_CORS_ORIGIN`: Default `https://onecurrency.tech`
- `BETTERSTACK_SOURCE_TOKEN`: Log shipping token (NOT in `.env.example`)
- `BETTERSTACK_INGESTING_HOST`: Log ingestion host (NOT in `.env.example`)
- `RESEND_API_KEY`: Email API key (NOT in `.env.example`)
- `EMAIL_FROM`: Sender address (format: `Name <email@domain.com>` or `email@domain.com`, NOT in `.env.example`)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`: Cloudflare R2 (all-or-nothing, optional, NOT in `.env.example`)
- `R2_PUBLIC_URL`: Public URL for R2 files (optional)

### Frontend Required (`frontend/env.ts`)

- `NEXT_PUBLIC_API_URL`: Backend API URL
- `NEXT_PUBLIC_POSTHOG_HOST`: PostHog analytics host
- `NEXT_PUBLIC_POSTHOG_KEY`: PostHog project key
- `NEXT_PUBLIC_CHAIN_ID`: `31337` (local) or `11155111` (Sepolia, default)
- `NEXT_PUBLIC_WALLET_CONNECT_ID`: Reown AppKit / WalletConnect project ID
- `NEXT_PUBLIC_BETTER_AUTH_URL`: Auth server URL (NOT in `.env.example`)
- `NEXT_PUBLIC_ONECURRENCY_ADDRESS`: Deployed contract address (NOT in `.env.example`)

### Contracts Required (`contracts/env.ts`)

- `SEPOLIA_RPC_URL`: Sepolia RPC endpoint
- `SEPOLIA_PRIVATE_KEY`: Deployer private key (hex 64 chars)
- `ETHERSCAN_API_KEY`: For contract verification
- `BETTERSTACK_SOURCE_TOKEN`: Log shipping token

## Testing

- **Frontend**: Vitest 4.1.0 with 3 projects:
  1. `unit` — jsdom environment, `src/**/*.{test,spec}.{ts,tsx}`
  2. `browser` — Playwright/Chromium, same glob
  3. `storybook` — Playwright/Chromium headless, uses `@storybook/addon-vitest`
- **Backend**: No test framework configured. `backend/tests/` directory exists but is empty.
- **Contracts**: Hardhat 3 + Chai. `pnpm hh:test` or `npx hardhat test`. Focused runs via file path or `--grep`.
- **CI**: Only runs frontend tests (`pnpm test` at root). Contract and backend tests must be run manually.

## Common Pitfalls

- **Do not edit `frontend/components/ui/`** — shadcn generated, excluded from Biome. Use `npx shadcn@latest add <component>` to regenerate.
- **Backend uses Bun, not Node** — Always use `bun` or `pnpm` scripts in `backend/`. Do not use `node` or `npx` for backend commands.
- **Contracts has its own lockfile** — `contracts/pnpm-lock.yaml` is separate from root. Use `pnpm` within `contracts/` directory.
- **Environment variables are validated at runtime** — Missing vars will crash the app on startup. Check `backend/src/env.ts`, `frontend/env.ts`, and `contracts/env.ts` for required vars.
- **`.env.example` is incomplete** — Many required vars (especially `STRIPE_PUBLISHABLE_KEY`, `BETTERSTACK_*`, `RESEND_API_KEY`, `EMAIL_FROM`, `R2_*`, `NEXT_PUBLIC_BETTER_AUTH_URL`, `NEXT_PUBLIC_ONECURRENCY_ADDRESS`) are NOT listed in `.env.example`.
- **Frontend types depend on backend router** — Changing oRPC procedure signatures in `backend/src/orpc/` will break frontend TypeScript until `frontend/lib/api.ts` is updated.
- **Stripe webhooks need raw body** — The deposit webhook route at `backend/src/routes/deposits/` must remain a raw Hono route. Do not wrap it in oRPC.
- **Session middleware order matters** — In `backend/src/index.ts`, the better-auth session injection middleware must run BEFORE the oRPC handler is mounted, or procedures won't have access to `context.session`.
- **Database migrations are env-sensitive** — `drizzle.config.ts` outputs to `dev/` locally and `prod/` in production. Do not mix them up.
- **Financial tables are append-only** — Never update deposit, withdrawal, transfer, or blockchain transaction records. Create new records for corrections.
- **Dual IDs** — Internal `BIGINT` IDs are for foreign keys and joins. Public `UUID v7` IDs are for API responses and external references. Do not expose internal IDs in APIs.
- **R2 variables are all-or-nothing** — If any R2 var is set, all 4 (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`) must be set, or the app will crash on startup.
- **Frontend env validation is skipped in CI** — `frontend/env.ts` has `skipValidation: !!process.env.CI`, so missing env vars won't break CI builds but will break local dev.

## Deployment

- **Frontend**: Deployed to Vercel (`.vercel/` directory present).
- **Backend**: Docker + Railway (`railpack.json` specifies Bun 1.x runtime). Dockerfile in `backend/`.
- **Production domain**: `onecurrency.tech` (hardcoded in `backend/src/env.ts` defaults).
- **Logging stack**: Docker → Vector sidecar (`vector.toml`) → BetterStack (7-day observability) + PostgreSQL `audit_logs` table (permanent).

## Package Manager Quirks

- **Root overrides**: `pnpm-workspace.yaml` pins `vite: 8.0.0`, `vitest: 4.1.0`, and all `@vitest/*` packages to `4.1.0`. Do not upgrade independently.
- **Security overrides**: Multiple dependency overrides in `pnpm-workspace.yaml` for `hono`, `next`, `tar`, etc. Respect these — they are security/compatibility fixes.
- **Contracts lockfile**: `contracts/pnpm-lock.yaml` is managed separately. When updating contract dependencies, run `pnpm install` from within `contracts/`.

---

This document provides essential information for AI agents working on this repository.

## Project Overview

Monorepo for a currency application with three main components:

- **frontend**: Next.js 16 + React 19 + TypeScript app
- **backend**: Hono API server running on Bun
- **contracts**: Ethereum smart contracts using Hardhat 3 + Solidity 0.8.28

## Package Manager & Tooling

- **Package Manager**: pnpm 10.x (REQUIRED - specified in package.json)
- **Monorepo**: Turborepo with pnpm workspaces
- **Node Version**: 22.x
- **Formatting/Linting**: Biome 2.x with ultracite config
- **Git Hooks**: Husky with pre-commit formatting

## Build Commands

```bash
# Root level (runs across all packages)
pnpm dev          # Start all dev servers in parallel
pnpm build        # Build all packages
pnpm lint         # Lint all packages
pnpm test         # Run all tests
pnpm format:check # Check formatting with Biome

# Frontend only (cd frontend/)
pnpm dev          # Next.js dev server with Turbopack
pnpm build        # Production build
pnpm test         # Run Vitest tests
pnpm lint         # Biome lint
pnpm format       # Biome format --write

# Backend only (cd backend/)
bun run --hot src/index.ts  # Dev server with hot reload

# Contracts only (cd contracts/)
npx hardhat test           # Run Mocha tests
npx hardhat compile        # Compile Solidity contracts
```

## Testing

### Running Single Tests

**Frontend (Vitest):**

```bash
# Run a specific test file
cd frontend && pnpm test -- src/components/Button.test.tsx

# Run tests matching a pattern
cd frontend && pnpm test -- --testNamePattern="should render"

# Run tests in watch mode
cd frontend && pnpm test -- --watch
```

**Contracts (Mocha/Hardhat):**

```bash
# Run specific test file
cd contracts && npx hardhat test test/Counter.ts

# Run specific test
cd contracts && npx hardhat test --grep "should emit"
```

**Backend:**
No test framework currently configured.

## Code Style Guidelines

### Formatting

- **Indent**: 2 spaces (no tabs)
- **Line endings**: LF
- **Quotes**: Double quotes for strings
- **Max line length**: 80 characters (Biome default)
- **Trailing commas**: ES5 compatible

### TypeScript

- **Strict mode**: Enabled with all strict flags
- **Target**: ES2022
- **Module**: ESNext with verbatim module syntax
- **Null checks**: Strict null checks enabled
- **Indexed access**: No unchecked indexed access

#### Types vs Interfaces

**Prefer `type` over `interface`** unless specifically needing interface features:

Use `type` for:

- Component prop definitions (e.g., `type ButtonProps = {...}`)
- API response shapes
- Union types and discriminated unions
- Tuple types and mapped types

Use `interface` only when:

- Declaration merging is required
- Implementing with classes
- Extending multiple interfaces in complex inheritance chains

```typescript
// Good - use type for props
type ButtonProps = {
  variant: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
};

// Good - use type for API responses
type UserResponse = {
  id: string;
  name: string;
  balance: number;
};
```

#### Avoid Magic Numbers

**Never use magic numbers** in code. Always define constants with descriptive names.

```typescript
// Bad
const itemsPerPage = 10;
setTimeout(() => {}, 2000);

// Good
const ITEMS_PER_PAGE_MOBILE = 10;
const ITEMS_PER_PAGE_DESKTOP = 20;
const KYC_VERIFICATION_DELAY_MS = 2000;
```

- Place constants at the top of files or in dedicated constants files
- Use UPPER_SNAKE_CASE for true constants
- Include units in constant names when applicable (`_MS`, `_PX`, `_SECONDS`)

#### Avoid Nested Ternaries

Nested ternary expressions (`a ? b : c ? d : e`) hurt readability and are flagged by Biome's `lint/style/noNestedTernary` rule. Never chain more than one ternary level deep.

**Preferred replacements:**

1. **Lookup map / Record** (best for 3+ states based on a single value):

```typescript
const STATUS_CONFIG: Record<number, { variant: string; label: string }> = {
  [STATUS.PENDING]: { variant: "warning", label: "Pending Review" },
  [STATUS.VERIFIED]: { variant: "success", label: "Verified" },
  [STATUS.REJECTED]: { variant: "destructive", label: "Rejected" },
};

const config = STATUS_CONFIG[id] ?? { variant: "default", label: "Unknown" };
```

2. **If/else helper function** (best when logic depends on multiple variables):

```typescript
function getActionLabel() {
  if (isPending) return "Processing...";
  if (type === "seize") return "Seize Tokens";
  return "Remove";
}
```

3. **Extract sub-component** (best in JSX with complex branching UI):
   Extract the ternary logic into a standalone component like `<StatusBadge kycStatusId={id} />`.

#### General Examples

```typescript
// Good
function greet(name: string): string {
  return `Hello ${name}`;
}

// Use type-only imports
import type { Metadata } from "next";

// Explicit return types on exports
export const metadata: Metadata = {
  title: "App",
};
```

### Naming Conventions

- **Variables/functions**: camelCase (`getUserData`)
- **Components**: PascalCase (`UserProfile`)
- **Contracts**: PascalCase (`Counter.sol`)
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Files**: kebab-case for utilities, PascalCase for components
- **Types/Interfaces**: PascalCase with descriptive names

### Imports

Imports are automatically organized by Biome. Order:

1. External dependencies (react, next, etc.)
2. Internal absolute imports (`@/*`)
3. Internal relative imports

```typescript
// External
import { Hono } from "hono";
import type { Metadata } from "next";

// Internal absolute
import { Button } from "@/components/Button";

// Internal relative
import { utils } from "../lib/utils";
```

### Module Structure

- **Avoid barrel files** (index.ts that re-exports from other files)
- **Avoid export defaults** - always use named exports
- **Use direct imports** to the actual source file

Benefits:

- Better tree-shaking
- Improved IDE auto-import functionality
- Explicit dependencies and better code readability
- Prevents circular dependency issues

```typescript
// Bad - barrel file pattern
// index.ts
export * from "./kyc-statuses";
export * from "./roles";

// Good - direct imports in consumer files
import { kycStatuses } from "./db/schema/kyc-statuses";
import { roles } from "./db/schema/roles";
```

For tools like Drizzle that need to discover multiple files, use glob patterns in config:

```typescript
// drizzle.config.ts
schema: "./src/db/schema/**/*.ts";
```

### React/Next.js

- Use Server Components by default
- Add `'use client'` directive only when needed (hooks, browser APIs)
- Use Next.js Image component for images
- Prefer Tailwind CSS classes over inline styles
- Use the `app/` directory structure

### Solidity

- **Version**: ^0.8.28
- **License**: SPDX-License-Identifier (UNLICENSED for now)
- **Style**: 2-space indent, no trailing whitespace
- **Events**: Capitalized (e.g., `Increment`)
- **Errors**: Use require with descriptive messages

Example:

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract Counter {
  uint public x;

  event Increment(uint by);

  function incBy(uint by) public {
    require(by > 0, "incBy: increment should be positive");
    x += by;
    emit Increment(by);
  }
}
```

### Error Handling

- TypeScript: Use explicit error types, avoid `any`
- Prefer early returns over nested conditionals
- Use optional chaining (`?.`) and nullish coalescing (`??`)

```typescript
// Good
function processData(data?: UserData) {
  if (!data) return null;
  return data.name?.toLowerCase() ?? "unknown";
}

// Bad
function processData(data: any) {
  if (data && data.name) {
    return data.name.toLowerCase();
  }
  return "unknown";
}
```

### Git Workflow

- Pre-commit hook runs `ultracite fix` automatically
- CI runs: format check, lint, build (tests commented out currently)
- Use conventional commits if possible

## Important File Locations

- **Biome config**: `/biome.json`
- **TypeScript base**: `/tsconfig.base.json`
- **Turbo config**: `/turbo.json`
- **Workspace config**: `/pnpm-workspace.yaml`
- **Frontend config**: `/frontend/next.config.ts`
- **Contracts config**: `/contracts/hardhat.config.ts`

## Environment Variables

Copy from `.env.example` files in each package. Never commit:

- `.env`
- `.env.local`
- Private keys or RPC URLs

## Common Issues

1. **Biome formatting**: If format check fails, run `pnpm dlx ultracite fix`
2. **Lockfile**: Always use `--frozen-lockfile` in CI
3. **Turbopack**: Frontend uses `--turbopack` flag for faster builds
4. **Node version**: Use Node 22+ (specified in CI)

## Testing Best Practices

- Frontend: Use Vitest with React Testing Library
- Contracts: Use Hardhat + Ethers v6 + Chai
- Mock external APIs and blockchain interactions
- Write descriptive test names

Example test pattern:

```typescript
// Contracts
describe("Counter", () => {
  it("should emit Increment event on inc()", async () => {
    const counter = await ethers.deployContract("Counter");
    await expect(counter.inc()).to.emit(counter, "Increment").withArgs(1n);
  });
});
```

## Design System (OneCurrency)

### Color System (60-30-10 Rule)

- **60% Neutrals**: Cool slate backgrounds (OKLCH values)
- **30% Primary**: Trust blue (#2563eb)
- **10% Accents**: Success emerald, warning amber, destructive red
- Use OKLCH color format for perceptual uniformity
- Custom CSS variables over Tailwind defaults

### Mobile-First Requirements

- **Bottom tab bar is mandatory** for all screen sizes
- **4 tabs**: Home, Transfer, History, Profile
- Touch targets minimum 44px
- Responsive breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)

### Terminology (Web2/E-Wallet Language)

Use familiar financial terminology - never expose blockchain concepts to users:

| Use This                      | Not This         |
| ----------------------------- | ---------------- |
| Account / OneCurrency Balance | Wallet           |
| Add Money / Top Up            | Deposit          |
| Cash Out / Send to Bank       | Withdraw         |
| Receipt Reference             | Transaction Hash |
| Processing Fee                | Gas Fee          |
| Processing your funds...      | Minting Tokens   |

**Never mention**: Smart Contract, Blockchain, Web3, Crypto, Token, Mint

### Animation Guidelines

- Use Framer Motion sparingly for micro-interactions only
- **Acceptable animations**: Number tickers, skeleton loaders, modal popups, tab transitions
- **Duration**: 150-300ms with spring physics
- Always respect `prefers-reduced-motion`

### Currency Display Pattern

- **USD is "Source of Truth"** - primary large text
- **Local currency secondary** - smaller, muted text with "≈" prefix
- Always use `tabular-nums` for monetary values

```tsx
// Example currency display
<span className="text-2xl font-semibold tabular-nums">$1,234.56</span>
<span className="text-sm text-muted-foreground tabular-nums">≈ ₱69,876.54</span>
```
