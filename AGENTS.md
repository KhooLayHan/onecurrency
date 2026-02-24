# Agent Guidelines for OneCurrency

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

Example:

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
