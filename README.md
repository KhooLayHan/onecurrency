# OneCurrency

A full-stack digital currency application built as a Turborepo monorepo.
OneCurrency provides a seamless e-wallet experience powered by blockchain
infrastructure, bridging traditional finance with decentralized technology
through a modern web interface.

## Overview

OneCurrency is a currency management platform featuring:

- **Web Frontend**: A responsive Next.js application with real-time blockchain
  interactions, QR code generation, and comprehensive transaction history
- **API Backend**: A Hono-based server handling authentication, database
  operations, blockchain relayer functions, and Stripe payment processing
- **Smart Contracts**: Ethereum-compatible ERC20 tokens with role-based access
  control, minting/burning capabilities, and compliance features

## Tech Stack

| Layer         | Technology                                                      |
| ------------- | --------------------------------------------------------------- |
| **Frontend**  | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Framer Motion |
| **Backend**   | Hono 4, Bun runtime, Drizzle ORM, Neon PostgreSQL               |
| **Contracts** | Hardhat 3, Solidity 0.8.28, OpenZeppelin, Viem                  |
| **DevOps**    | Turborepo, pnpm 10, Biome 2, Husky, Docker                      |
| **Testing**   | Vitest, Playwright, Hardhat/Chai                                |

## Prerequisites

- [Node.js](https://nodejs.org/) 22.x
- [pnpm](https://pnpm.io/) 10.x
- [Bun](https://bun.sh/) 1.x (for backend development)
- [MetaMask](https://metamask.io/) or compatible Web3 wallet
- [Git](https://git-scm.com/)

## Project Structure

```
onecurrency/
├── frontend/          # Next.js application
│   ├── app/            # App router & pages
│   ├── components/     # React components
│   ├── lib/            # Utilities & hooks
│   └── ...
├── backend/            # Hono API server
│   ├── src/            # API routes, DB schema, services
│   ├── scripts/        # Deployment & utility scripts
│   └── ...
├── contracts/          # Ethereum smart contracts
│   ├── contracts/      # Solidity source files
│   ├── ignition/       # Hardhat Ignition deployment modules
│   └── test/           # Contract tests
├── packages/           # Shared packages
│   └── common/         # Shared utilities & types
├── docs/               # Documentation (roadmap, design system, schema)
├── biome.jsonc         # Biome formatting & linting config
├── turbo.json          # Turborepo pipeline config
└── pnpm-workspace.yaml # Workspace configuration
```

## Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd onecurrency
pnpm install
```

### 2. Environment Configuration

Copy the example environment file and configure your variables:

```bash
cp .env.example .env
```

Required environment variables include:

- **Database**: `DATABASE_URL` (Neon PostgreSQL connection string)
- **Blockchain**: `SEPOLIA_RPC_URL`, `SEPOLIA_PRIVATE_KEY`, `ETHERSCAN_API_KEY`
- **Authentication**: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- **Payments**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Encryption**: `MASTER_ENCRYPTION_KEY`

See `.env.example` for the complete list.

### 3. Database Setup

```bash
cd backend
pnpm db:generate   # Generate Drizzle migrations
pnpm db:migrate    # Run migrations
pnpm db:seed       # Seed initial data (optional)
```

### 4. Smart Contract Setup (Optional)

```bash
cd contracts
pnpm hh:build      # Compile contracts
```

## Development Commands

### Root-Level (Turborepo)

```bash
pnpm dev          # Start all dev servers in parallel
pnpm build        # Build all packages
pnpm lint         # Lint all packages
pnpm test         # Run all tests
pnpm format:check # Check formatting with Biome
```

### Frontend (Next.js)

```bash
cd frontend
pnpm dev          # Next.js dev server with Turbopack (http://localhost:3000)
pnpm build        # Production build
pnpm test         # Run Vitest unit tests
pnpm test:browser # Run Playwright browser tests
pnpm lint         # Biome lint
pnpm format       # Biome format --write
pnpm storybook    # Start Storybook (http://localhost:6006)
```

### Backend (Hono)

```bash
cd backend
bun run --hot src/index.ts  # Dev server with hot reload
pnpm db:studio              # Open Drizzle Studio
pnpm db:push                # Push schema changes
```

### Contracts (Hardhat)

```bash
cd contracts
pnpm hh:test           # Run contract tests
pnpm hh:build          # Compile contracts
pnpm hh:node           # Start local Hardhat node
pnpm hh:deploy         # Deploy to local network
pnpm hh:prod-deploy    # Deploy to Sepolia testnet
```

## Testing

### Frontend (Vitest + React Testing Library)

```bash
# Run specific test file
cd frontend && pnpm test -- src/components/Button.test.tsx

# Run tests matching a pattern
cd frontend && pnpm test -- --testNamePattern="should render"

# Run tests in watch mode
cd frontend && pnpm test -- --watch
```

### Contracts (Hardhat + Ethers v6 + Chai)

```bash
# Run specific test file
cd contracts && npx hardhat test test/Counter.ts

# Run specific test
cd contracts && npx hardhat test --grep "should emit"
```

### Backend

No test framework is currently configured. The project uses Drizzle ORM with
a Neon PostgreSQL database for data persistence.

## Code Style

This project uses **Biome 2** with the ultracite configuration for consistent
formatting and linting across all packages.

- **Indent**: 2 spaces
- **Quotes**: Double quotes
- **Line endings**: LF
- **Max line length**: 80 characters

A pre-commit hook (Husky) automatically formats staged files on every commit.

Please refer to [AGENTS.md](AGENTS.md) for detailed development guidelines,
design system specifications, and architecture decisions.

## License

UNLICENSED
