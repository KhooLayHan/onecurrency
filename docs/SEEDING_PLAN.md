# Database Seeding Plan

This document outlines the strategy for generating realistic fake data for development and testing purposes using Faker.js and factory functions.

## Overview

**Goal**: Generate 100+ users with complete related data (wallets, sessions, transactions, deposits) spanning 6 months of history.

**Target Records**:

- 100 users (2 special + 98 generated)
- ~150 wallets (1-2 per user)
- ~200 sessions (1-3 per user)
- ~30 OAuth accounts
- ~110 role assignments
- ~360 blockchain transactions
- ~400 deposits
- ~50 verification codes
- ~10 blacklisted addresses
- ~100 webhook events
- ~1,000+ audit logs (auto-generated via triggers)

## Technology Stack

- **Faker.js**: `@faker-js/faker` v10.3.0
- **ORM**: Drizzle ORM with PostgreSQL
- **Batch Size**: 50 records per insert for performance
- **Hashing**: Better-Auth password hashing for special users

## Seeding Order (Dependency Chain)

```text
1. Lookup Tables (Already Seeded)
   ├── kyc_statuses
   ├── transaction_statuses
   ├── transaction_types
   ├── networks
   └── roles

2. Core Entities (In Order)
   ├── Special Users (admin@onecurrency.com, user@onecurrency.com)
   ├── Regular Users (98 generated)
   ├── Wallets (1-2 per user)
   ├── Sessions (1-3 per user)
   ├── OAuth Accounts (30% of users)
   └── User Roles (role assignments)

3. Financial Data
   ├── Blockchain Transactions (pre-create for deposits)
   └── Deposits (link to transactions based on status)

4. Supporting Data (Any Order)
   ├── Verifications (email codes)
   ├── Blacklisted Addresses (compliance)
   └── Webhook Events (Stripe history)
```

## Factory Function Design

### Main Orchestrator

```typescript
// backend/src/db/seed/index.ts
export interface SeedConfig {
  users: {
    count: number;
    kycDistribution: Record<number, number>;
    dateRangeMonths: number;
    specialUsers: SpecialUserConfig[];
  };
  wallets: { perUser: { min: number; max: number } };
  sessions: { perUser: { min: number; max: number } };
  userRoles: {
    roleDistribution: Record<number, number>;
  };
  deposits: {
    perUser: { min: number; max: number };
    statusDistribution: {
      completed: number; // 60% - Successful end-to-end
      pending: number; // 20% - User hasn't finished Stripe checkout
      failedNoTx: number; // 15% - Card declined, no blockchain tx
      hybridFailed: number; // 5% - Stripe worked, blockchain failed
    };
  };
}
```

### Default Configuration

```typescript
const defaultSeedConfig: SeedConfig = {
  users: {
    count: 100,
    kycDistribution: {
      1: 30, // None - New users
      2: 20, // Pending - In progress
      3: 40, // Verified - Approved
      4: 8, // Rejected - Failed KYC
      5: 2, // Expired - Expired verification
    },
    dateRangeMonths: 6,
    specialUsers: [
      {
        email: "admin@onecurrency.com",
        password: "Admin123!",
        name: "System Administrator",
        roleId: 2, // admin
        kycStatusId: 3, // verified
        depositLimitCents: 1000000, // $10,000
        emailVerified: true,
      },
      {
        email: "user@onecurrency.com",
        password: "Test123!",
        name: "Test User",
        roleId: 1, // user
        kycStatusId: 3, // verified
        depositLimitCents: 100000, // $1,000
        emailVerified: true,
      },
    ],
  },
  wallets: { perUser: { min: 1, max: 2 } },
  sessions: { perUser: { min: 1, max: 3 } },
  userRoles: {
    roleDistribution: {
      1: 95, // user
      2: 2, // admin
      3: 1, // compliance
      4: 2, // support
    },
  },
  deposits: {
    perUser: { min: 3, max: 5 },
    statusDistribution: {
      completed: 60, // Stripe success → Mint success
      pending: 20, // User in Stripe checkout
      failedNoTx: 15, // Card declined
      hybridFailed: 5, // Stripe success → Mint failed
    },
  },
};
```

## Data Distribution Rules

### Users

**KYC Status Distribution**:

- 30% `None` (ID: 1) - New users who haven't started KYC
- 20% `Pending` (ID: 2) - Documents submitted, awaiting review
- 40% `Verified` (ID: 3) - KYC approved, full access
- 8% `Rejected` (ID: 4) - KYC failed
- 2% `Expired` (ID: 5) - KYC verification expired

**Deposit Limits by KYC Status**:

- None/Rejected/Expired: $100-$500 (1,000-5,000 cents)
- Pending: $500-$1,000 (5,000-10,000 cents)
- Verified: $1,000-$10,000 (10,000-100,000 cents)

**Created At**: Spread over 6 months using `faker.date.past({ years: 0.5 })`

### Wallets

**Quantity**: 1-2 wallets per user (random)

**Type Distribution**:

- 80% `EXTERNAL` (MetaMask, WalletConnect, etc.)
- 20% `CUSTODIAL` (platform-managed)

**Network**:

- 100% Sepolia (network_id: 1, chain_id: 11155111)
- Primary wallet flag: 1st wallet is primary

**Wallet Labels**:

- Primary: "Main Wallet", "Trading Wallet"
- Secondary: "Savings", "Backup", "DApp Wallet"

**Providers** (for EXTERNAL):

- MetaMask (70%)
- WalletConnect (20%)
- Coinbase Wallet (10%)

### Sessions

**Quantity**: 1-3 sessions per user

**Status Distribution**:

- 40% Active (expires_at > now + 7 days)
- 60% Expired (expires_at < now)

**Data**:

- Realistic user agents (Chrome, Firefox, Safari)
- Random IP addresses
- Created dates within user registration date

### User Roles

**Distribution**:

- 95% `user` role (ID: 1)
- 2% `admin` role (ID: 2)
- 1% `compliance` role (ID: 3)
- 2% `support` role (ID: 4)

**Note**: All users get at least the `user` role. Special users override this.

### Blockchain Transactions

**Type Distribution**:

- 70% `Mint` (token minting from deposits)
- 20% `Transfer` (user-to-user transfers)
- 10% `Burn` (token redemption)

**Status Logic**:

- For completed deposits: `is_confirmed: true`, `confirmations: 1-50`
- For hybrid-failed: `is_confirmed: false`, `confirmations: 0`, `gas_used: 0`
- For failed/pending deposits: No blockchain transaction

**Realistic Values**:

- Gas price: 10-100 gwei
- Gas used: 21,000-150,000
- Block numbers: Recent Sepolia blocks
- Amounts: Match corresponding deposits

### Deposits (Status Logic)

**Status Distribution**:

1. **Completed (60%)** - End-to-end success
   - `status_id`: 3 (Completed)
   - `blockchain_tx_id`: Linked to confirmed mint transaction
   - `completed_at`: Set to recent date
   - `stripe_session_id`: Valid test session ID

2. **Pending (20%)** - User in Stripe checkout
   - `status_id`: 1 (Pending)
   - `blockchain_tx_id`: NULL
   - `completed_at`: NULL
   - `created_at`: Very recent (within 24 hours)

3. **Failed - No Transaction (15%)** - Card declined
   - `status_id`: 4 (Failed)
   - `blockchain_tx_id`: NULL
   - `completed_at`: NULL
   - Failure reason: Simulated in metadata

4. **Hybrid Failed (5%)** - Stripe success, blockchain failed
   - `status_id`: 2 (Processing - stuck)
   - `blockchain_tx_id`: Linked to failed transaction
   - `completed_at`: NULL
   - Blockchain tx: `is_confirmed: false`, `gas_used: 0`

**Amount Distribution**:

- 60% Small: $10-$100 (1,000-10,000 cents)
- 30% Medium: $100-$1,000 (10,000-100,000 cents)
- 10% Large: $1,000-$5,000 (100,000-500,000 cents)

**Fees**: 1-3% of deposit amount

### Verifications

**Quantity**: ~50 codes

**Types**:

- Email verification (60%)
- Password reset (30%)
- 2FA setup (10%)

**Status**:

- 70% Expired
- 30% Active (recently created)

### Blacklisted Addresses

**Quantity**: ~10 addresses

**Reasons**:

- "OFAC sanctioned entity" (40%)
- "Suspicious activity detected" (30%)
- "Fraudulent transaction pattern" (20%)
- "Internal compliance flag" (10%)

**Sources**:

- OFAC (50%)
- Chainalysis (30%)
- Internal (20%)

**Networks**: All Sepolia

### Webhook Events

**Quantity**: ~100 events

**Event Types**:

- `checkout.session.completed` (60%)
- `payment_intent.created` (15%)
- `payment_intent.succeeded` (10%)
- `payment_intent.payment_failed` (10%)
- `charge.dispute.created` (5%)

**Processing Status**:

- 80% Processed successfully
- 15% Unprocessed (pending)
- 5% Failed with error

## Realistic Data Generation

### Faker.js Patterns

```typescript
// Ethereum Address (40 hex chars + 0x prefix)
const address = `0x${faker.string.hexadecimal({ length: 40, casing: "lower" })}`;

// Transaction Hash (64 hex chars + 0x prefix)
const txHash = `0x${faker.string.hexadecimal({ length: 64, casing: "lower" })}`;

// Stripe Session ID
const stripeSessionId = `cs_test_${faker.string.alphanumeric(56)}`;

// Stripe Customer ID
const stripeCustomerId = `cus_${faker.string.alphanumeric(14)}`;

// Stripe Payment Intent ID
const stripePaymentIntentId = `pi_${faker.string.alphanumeric(24)}`;

// Block Hash
const blockHash = `0x${faker.string.hexadecimal({ length: 64, casing: "lower" })}`;
```

### Date Generation

```typescript
// User registration dates: spread over 6 months
const createdAt = faker.date.past({ years: 0.5 });

// Sessions: after user creation
const sessionCreatedAt = faker.date.between(createdAt, new Date());

// Deposits: after user creation, recent ones for pending status
const depositCreatedAt =
  status === "pending"
    ? faker.date.recent({ days: 1 })
    : faker.date.between(createdAt, new Date());
```

## Batch Insert Strategy

For performance, use batch inserts of 50 records at a time:

```typescript
const BATCH_SIZE = 50;

async function batchInsert<T>(
  table: PgTable,
  records: T[],
  batchSize = BATCH_SIZE,
): Promise<void> {
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await db.insert(table).values(batch).onConflictDoNothing();
  }
}
```

## Special Users

### Admin User

- **Email**: `admin@onecurrency.com`
- **Password**: `Admin123!` (pre-hashed)
- **Role**: `admin` (full permissions)
- **KYC**: Verified
- **Deposit Limit**: $10,000

### Test User

- **Email**: `user@onecurrency.com`
- **Password**: `User123!` (pre-hashed)
- **Role**: `user` (standard permissions)
- **KYC**: Verified
- **Deposit Limit**: $1,000

### Password Hashing

Use Bun's password hashing utility:

```typescript
const passwordHash = await Bun.password.hash(password, {
  algorithm: "argon2id",
});
```

## File Structure

```text
backend/src/db/seed/
├── index.ts                    # Main orchestrator & export
├── config.ts                   # Default configurations
├── helpers.ts                  # Shared utilities
├── types.ts                    # TypeScript interfaces
├── special-users.ts            # Admin & test users
├── users.ts                    # User factory
├── wallets.ts                  # Wallet factory
├── sessions.ts                 # Session factory
├── accounts.ts                 # OAuth account factory
├── user-roles.ts               # Role assignment factory
├── blockchain-transactions.ts  # Transaction factory
├── deposits.ts                 # Deposit factory
├── verifications.ts            # Verification codes
├── blacklisted-addresses.ts    # Blacklist factory
└── webhook-events.ts           # Stripe webhooks
```

## Running the Seeds

```typescript
// In backend/src/seeding.ts or a new seed script
import { seedDatabase, defaultSeedConfig } from "./db/seed";

async function main() {
  // Run with default config
  await seedDatabase(defaultSeedConfig);

  // Or customize
  await seedDatabase({
    ...defaultSeedConfig,
    users: {
      ...defaultSeedConfig.users,
      count: 200, // More users for load testing
    },
  });
}
```

## Audit Logs Note

Audit logs are automatically created by database triggers for:

- INSERT/UPDATE on `users`
- INSERT/UPDATE on `wallets`
- INSERT/UPDATE on `deposits`
- INSERT/UPDATE on `blockchain_transactions`
- INSERT/DELETE on `user_roles`

**Expected**: ~1,000+ audit entries from seeding

## Constraints & Validation

All seed data must respect database constraints:

- **Users**: Unique email (soft-deleted users excluded)
- **Wallets**: Valid Ethereum address format, unique per network
- **Blockchain Transactions**: Valid tx hash format (0x + 64 hex), unique per network
- **Deposits**: Positive amounts, fees ≤ amount, positive token amounts
- **Sessions**: Unique token
- **All**: Referential integrity maintained

## Future Enhancements

When implementing deferred tables:

1. **Withdrawals**: Burn transactions, fiat payouts
2. **KYC Documents**: Document uploads, verification workflow
3. **Token Balances**: Cached on-chain balances

---

_Last Updated: February 2026_
_Schema Version: 1.1_
