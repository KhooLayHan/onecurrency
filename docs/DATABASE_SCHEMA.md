# Database Schema Documentation

## Overview

This document outlines the PostgreSQL database schema for the OneCurrency platform - a fiat-to-crypto bridge enabling USD deposits and OneCurrency token minting. The schema integrates **Better-Auth** for authentication and follows financial application best practices.

## Technology Stack

- **Database**: PostgreSQL 18+ (via Neon)
- **ORM**: Drizzle ORM
- **Auth**: Better-Auth
- **Validation**: Zod
- **UUID Generation**: Native PostgreSQL `uuidv7()` function

## Design Principles

| Principle               | Implementation                                                         |
| ----------------------- | ---------------------------------------------------------------------- |
| **Dual ID Strategy**    | `id` (BIGINT) for internal use + `public_id` (UUIDv7) for API exposure |
| **No Enums**            | Lookup tables for all status/type values                               |
| **Financial Integrity** | `NUMERIC(78,0)` for tokens (uint256), `BIGINT` for USD cents           |
| **Database Validation** | `UNIQUE`, `CHECK`, and `NOT NULL` constraints                          |
| **Auditability**        | `audit_logs` table with triggers on sensitive operations               |
| **Immutability**        | Blockchain and financial tables are append-only                        |
| **Soft Deletes**        | `deleted_at` on mutable entities                                       |

## Table Summary

### Core Tables (18 Total) + Optional (3)

| Category                | Count | Tables                                                          |
| ----------------------- | ----- | --------------------------------------------------------------- |
| **Authentication**      | 4     | users, sessions, accounts, verifications                        |
| **RBAC**                | 2     | roles, user_roles                                               |
| **Lookup**              | 4     | kyc_statuses, transaction_statuses, transaction_types, networks |
| **User Data**           | 1     | wallets                                                         |
| **Financial**           | 2     | deposits, blockchain_transactions                               |
| **Compliance**          | 3     | audit_logs, blacklisted_addresses, webhook_events               |
| **Optional (Deferred)** | 3     | withdrawals, kyc_documents, token_balances                      |

## Detailed Schema

### 1. Lookup Tables

#### kyc_statuses

Immutable lookup for KYC verification states.

| Column      | Type         | Constraints                               | Notes                                                |
| ----------- | ------------ | ----------------------------------------- | ---------------------------------------------------- |
| id          | INT          | PRIMARY KEY, GENERATED ALWAYS AS IDENTITY | Internal ID                                          |
| name        | VARCHAR(100) | NOT NULL, UNIQUE                          | 'None', 'Pending', 'Verified', 'Rejected', 'Expired' |
| description | TEXT         |                                           | Human-readable description                           |
| created_at  | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()                   | Immutable timestamp                                  |

**Seed Data:**

```sql
INSERT INTO kyc_statuses (name, description) VALUES
  ('None', 'KYC not started'),
  ('Pending', 'KYC documents submitted, awaiting review'),
  ('Verified', 'KYC approved'),
  ('Rejected', 'KYC rejected'),
  ('Expired', 'KYC verification expired');
```

#### transaction_statuses

Immutable lookup for deposit/withdrawal statuses (merged from separate tables).

| Column      | Type         | Constraints                               | Notes                                                      |
| ----------- | ------------ | ----------------------------------------- | ---------------------------------------------------------- |
| id          | INT          | PRIMARY KEY, GENERATED ALWAYS AS IDENTITY | Internal ID                                                |
| name        | VARCHAR(100) | NOT NULL, UNIQUE                          | 'Pending', 'Processing', 'Completed', 'Failed', 'Refunded' |
| description | TEXT         |                                           | Human-readable description                                 |
| created_at  | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()                   | Immutable timestamp                                        |

**Seed Data:**

```sql
INSERT INTO transaction_statuses (name, description) VALUES
  ('Pending', 'Transaction initiated, awaiting processing'),
  ('Processing', 'Transaction being processed'),
  ('Completed', 'Transaction successfully completed'),
  ('Failed', 'Transaction failed'),
  ('Refunded', 'Transaction refunded');
```

#### transaction_types

Immutable lookup for blockchain transaction types.

| Column      | Type         | Constraints                               | Notes                      |
| ----------- | ------------ | ----------------------------------------- | -------------------------- |
| id          | INT          | PRIMARY KEY, GENERATED ALWAYS AS IDENTITY | Internal ID                |
| name        | VARCHAR(100) | NOT NULL, UNIQUE                          | 'Mint', 'Burn', 'Transfer' |
| description | TEXT         |                                           | Human-readable description |
| created_at  | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()                   | Immutable timestamp        |

**Seed Data:**

```sql
INSERT INTO transaction_types (name, description) VALUES
  ('Mint', 'Tokens minted to address'),
  ('Burn', 'Tokens burned from address'),
  ('Transfer', 'Tokens transferred between addresses');
```

#### networks

Immutable lookup for blockchain networks (retains public_id for API consistency).

| Column           | Type         | Constraints                               | Notes                              |
| ---------------- | ------------ | ----------------------------------------- | ---------------------------------- |
| id               | INT          | PRIMARY KEY, GENERATED ALWAYS AS IDENTITY | Internal ID                        |
| public_id        | UUID         | NOT NULL, UNIQUE, DEFAULT uuidv7()        | API-exposed ID                     |
| name             | VARCHAR(100) | NOT NULL, UNIQUE                          | 'Ethereum', 'Sepolia', 'Optimism'  |
| chain_id         | BIGINT       | NOT NULL, UNIQUE                          | Network chain ID (1, 11155111, 10) |
| rpc_url          | TEXT         |                                           | RPC endpoint URL                   |
| explorer_url     | TEXT         |                                           | Block explorer URL                 |
| contract_address | VARCHAR(42)  | CHECK (address format)                    | OneCurrency token contract         |
| is_testnet       | BOOLEAN      | NOT NULL, DEFAULT FALSE                   | Testnet flag                       |
| is_active        | BOOLEAN      | NOT NULL, DEFAULT TRUE                    | Active for deposits                |
| created_at       | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()                   | Immutable timestamp                |

**Seed Data:**

```sql
INSERT INTO networks (name, chain_id, is_testnet, is_active) VALUES
  ('Sepolia', 11155111, TRUE, TRUE),
  ('Ethereum', 1, FALSE, FALSE),
  ('Optimism', 10, FALSE, FALSE);
```

**Indexes:**

- `idx_networks_active` (partial): WHERE is_active = TRUE

---

### 2. RBAC Tables

#### roles

Immutable lookup for role-based access control.

| Column      | Type         | Constraints                               | Notes                         |
| ----------- | ------------ | ----------------------------------------- | ----------------------------- |
| id          | INT          | PRIMARY KEY, GENERATED ALWAYS AS IDENTITY | Internal ID                   |
| public_id   | UUID         | NOT NULL, UNIQUE, DEFAULT uuidv7()        | API-exposed ID                |
| name        | VARCHAR(100) | NOT NULL, UNIQUE                          | 'admin', 'user', 'compliance' |
| description | TEXT         |                                           | Role description              |
| permissions | JSONB        | NOT NULL, DEFAULT '[]'                    | Array of permission strings   |
| created_at  | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()                   | Immutable timestamp           |

**Seed Data:**

```sql
INSERT INTO roles (name, description, permissions) VALUES
  ('user', 'Standard user', '["deposit:create", "withdrawal:create", "wallet:read"]'::jsonb),
  ('admin', 'Administrator', '["*"]'::jsonb),
  ('compliance', 'Compliance officer', '["blacklist:manage", "kyc:verify"]'::jsonb),
  ('support', 'Support staff', '["user:read", "deposit:read"]'::jsonb);
```

#### user_roles

Junction table for many-to-many user-role relationships. Roles are explicitly assigned.

| Column             | Type        | Constraints                                       | Notes                  |
| ------------------ | ----------- | ------------------------------------------------- | ---------------------- |
| id                 | BIGINT      | PRIMARY KEY, GENERATED ALWAYS AS IDENTITY         | Internal ID            |
| user_id            | BIGINT      | NOT NULL, REFERENCES users(id), ON DELETE CASCADE | User FK                |
| role_id            | INT         | NOT NULL, REFERENCES roles(id), ON DELETE CASCADE | Role FK                |
| granted_by_user_id | BIGINT      | REFERENCES users(id)                              | Admin who granted role |
| granted_at         | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()                           | When role was granted  |

**Constraints:**

- `uq_user_role`: UNIQUE (user_id, role_id)

**Indexes:**

- `idx_user_roles_user`: user_id
- `idx_user_roles_role`: role_id
- `idx_user_roles_granted_by`: granted_by_user_id

---

### 3. Authentication Tables (Better-Auth)

#### users

Core user entity with Better-Auth integration and OneCurrency extensions.

| Column              | Type         | Constraints                                      | Notes                                |
| ------------------- | ------------ | ------------------------------------------------ | ------------------------------------ |
| id                  | BIGINT       | PRIMARY KEY, GENERATED ALWAYS AS IDENTITY        | Internal ID                          |
| name                | VARCHAR(255) | NOT NULL                                         | Display name                         |
| email               | VARCHAR(255) | NOT NULL                                         | Validated via Zod in app code        |
| email_verified      | BOOLEAN      | NOT NULL, DEFAULT FALSE                          | Email verification status            |
| image               | TEXT         |                                                  | Profile image URL                    |
| created_at          | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()                          | Account creation                     |
| updated_at          | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()                          | Last update (trigger-managed)        |
| public_id           | UUID         | NOT NULL, UNIQUE, DEFAULT uuidv7()               | API-exposed ID                       |
| kyc_status_id       | INT          | NOT NULL, DEFAULT 1, REFERENCES kyc_statuses(id) | KYC status FK                        |
| kyc_verified_at     | TIMESTAMPTZ  |                                                  | When KYC was approved                |
| deposit_limit_cents | BIGINT       | NOT NULL, DEFAULT 100000                         | Max deposit in cents ($1000 default) |
| deleted_at          | TIMESTAMPTZ  |                                                  | Soft delete timestamp                |

**Constraints:**

- `uq_users_email_active`: UNIQUE (email) WHERE deleted_at IS NULL
- `chk_deposit_limit`: CHECK (deposit_limit_cents >= 0)

**Indexes:**

- `idx_users_public_id`: public_id
- `idx_users_kyc_status`: kyc_status_id
- `idx_users_created`: created_at DESC

#### sessions

Better-Auth session management.

| Column     | Type        | Constraints                                       | Notes              |
| ---------- | ----------- | ------------------------------------------------- | ------------------ |
| id         | BIGINT      | PRIMARY KEY, GENERATED ALWAYS AS IDENTITY         | Session ID         |
| user_id    | BIGINT      | NOT NULL, REFERENCES users(id), ON DELETE CASCADE | User FK            |
| token      | TEXT        | NOT NULL, UNIQUE                                  | Session token      |
| expires_at | TIMESTAMPTZ | NOT NULL                                          | Session expiration |
| ip_address | TEXT        |                                                   | Client IP          |
| user_agent | TEXT        |                                                   | Client user agent  |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()                           | Session start      |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()                           | Last activity      |

**Indexes:**

- `idx_sessions_user_id`: user_id
- `idx_sessions_expires`: expires_at

#### accounts

Better-Auth OAuth/credential accounts.

| Column                   | Type        | Constraints                                       | Notes                                            |
| ------------------------ | ----------- | ------------------------------------------------- | ------------------------------------------------ |
| id                       | BIGINT      | PRIMARY KEY, GENERATED ALWAYS AS IDENTITY         | Account ID                                       |
| user_id                  | BIGINT      | NOT NULL, REFERENCES users(id), ON DELETE CASCADE | User FK                                          |
| account_id               | TEXT        | NOT NULL                                          | Provider's account ID                            |
| provider_id              | TEXT        | NOT NULL                                          | Provider name ('google', 'github', 'credential') |
| access_token             | TEXT        |                                                   | OAuth access token                               |
| refresh_token            | TEXT        |                                                   | OAuth refresh token                              |
| access_token_expires_at  | TIMESTAMPTZ |                                                   | Access token expiry                              |
| refresh_token_expires_at | TIMESTAMPTZ |                                                   | Refresh token expiry                             |
| scope                    | TEXT        |                                                   | OAuth scope                                      |
| id_token                 | TEXT        |                                                   | OIDC ID token                                    |
| password                 | TEXT        |                                                   | Hashed password (credential provider only)       |
| created_at               | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()                           | Creation timestamp                               |
| updated_at               | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()                           | Last update                                      |

**Indexes:**

- `idx_accounts_user_id`: user_id
- `idx_accounts_provider`: UNIQUE (provider_id, account_id)

#### verifications

Better-Auth email verification and password reset tokens.

| Column     | Type        | Constraints                               | Notes                   |
| ---------- | ----------- | ----------------------------------------- | ----------------------- |
| id         | BIGINT      | PRIMARY KEY, GENERATED ALWAYS AS IDENTITY | Verification ID         |
| identifier | TEXT        | NOT NULL                                  | Email or identifier     |
| value      | TEXT        | NOT NULL                                  | Verification token/code |
| expires_at | TIMESTAMPTZ | NOT NULL                                  | Token expiration        |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()                   | Creation timestamp      |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()                   | Last update             |

**Indexes:**

- `idx_verifications_identifier`: identifier
- `idx_verifications_expires`: expires_at

---

### 4. User Wallets

#### wallets

User blockchain wallet addresses with custodial/external classification.

| Column            | Type         | Constraints                                       | Notes                                                   |
| ----------------- | ------------ | ------------------------------------------------- | ------------------------------------------------------- |
| id                | BIGINT       | PRIMARY KEY, GENERATED ALWAYS AS IDENTITY         | Internal ID                                             |
| public_id         | UUID         | NOT NULL, UNIQUE, DEFAULT uuidv7()                | API-exposed ID                                          |
| user_id           | BIGINT       | NOT NULL, REFERENCES users(id), ON DELETE CASCADE | User FK                                                 |
| network_id        | INT          | NOT NULL, REFERENCES networks(id)                 | Network FK                                              |
| address           | VARCHAR(42)  | NOT NULL                                          | Ethereum address                                        |
| label             | VARCHAR(100) |                                                   | User-defined label                                      |
| is_primary        | BOOLEAN      | NOT NULL, DEFAULT FALSE                           | Primary wallet flag                                     |
| wallet_type       | VARCHAR(20)  | NOT NULL, DEFAULT 'EXTERNAL', CHECK               | 'CUSTODIAL' or 'EXTERNAL'                               |
| provider_name     | VARCHAR(50)  |                                                   | Analytics: 'MetaMask', 'WalletConnect', etc.            |
| encryption_key_id | VARCHAR(255) |                                                   | Key reference for custodial wallets (NULL for external) |
| created_at        | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()                           | Creation timestamp                                      |
| updated_at        | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()                           | Last update (trigger-managed)                           |
| deleted_at        | TIMESTAMPTZ  |                                                   | Soft delete timestamp                                   |

**Constraints:**

- `chk_eth_address`: CHECK (address ~\* '^0x[a-fA-F0-9]{40}$')

**Indexes:**

- `idx_wallets_address_network_unique`: UNIQUE INDEX ON (LOWER(address), network_id, deleted_at) - Case-insensitive address matching
- `idx_wallets_user`: user_id WHERE deleted_at IS NULL
- `idx_wallets_network`: network_id
- `idx_wallets_type`: wallet_type
- `idx_wallets_provider`: provider_name
- `idx_wallets_primary`: UNIQUE (user_id, network_id) WHERE is_primary = TRUE AND deleted_at IS NULL

---

### 5. Financial Tables

#### deposits

Immutable fiat deposit records (Stripe payments).

| Column                   | Type          | Constraints                                           | Notes                      |
| ------------------------ | ------------- | ----------------------------------------------------- | -------------------------- |
| id                       | BIGINT        | PRIMARY KEY, GENERATED ALWAYS AS IDENTITY             | Internal ID                |
| public_id                | UUID          | NOT NULL, UNIQUE, DEFAULT uuidv7()                    | API-exposed ID             |
| user_id                  | BIGINT        | NOT NULL, REFERENCES users(id)                        | User FK                    |
| wallet_id                | BIGINT        | NOT NULL, REFERENCES wallets(id)                      | Target wallet FK           |
| status_id                | INT           | NOT NULL, REFERENCES transaction_statuses(id)         | Business logic status      |
| stripe_session_id        | VARCHAR(255)  | NOT NULL, UNIQUE                                      | Stripe checkout session ID |
| stripe_payment_intent_id | VARCHAR(255)  | UNIQUE                                                | Stripe payment intent ID   |
| stripe_customer_id       | VARCHAR(255)  |                                                       | Stripe customer ID         |
| amount_cents             | BIGINT        | NOT NULL                                              | Fiat amount in cents       |
| fee_cents                | BIGINT        | NOT NULL, DEFAULT 0                                   | Fee amount in cents        |
| net_amount_cents         | BIGINT        | GENERATED ALWAYS AS (amount_cents - fee_cents) STORED | Net deposit                |
| token_amount             | NUMERIC(78,0) | NOT NULL                                              | Tokens to mint (wei)       |
| exchange_rate            | NUMERIC(19,8) | NOT NULL, DEFAULT 1.0                                 | USD/token rate             |
| blockchain_tx_id         | BIGINT        | REFERENCES blockchain_transactions(id)                | Linked mint transaction    |
| idempotency_key          | VARCHAR(255)  | UNIQUE                                                | Idempotency key            |
| ip_address               | INET          |                                                       | Client IP address          |
| user_agent               | TEXT          |                                                       | Client user agent          |
| created_at               | TIMESTAMPTZ   | NOT NULL, DEFAULT NOW()                               | Creation timestamp         |
| completed_at             | TIMESTAMPTZ   |                                                       | Completion timestamp       |

**Constraints:**

- `chk_amount_positive`: CHECK (amount_cents > 0)
- `chk_fee_nonnegative`: CHECK (fee_cents >= 0)
- `chk_fee_lte_amount`: CHECK (fee_cents <= amount_cents)
- `chk_token_amount_positive`: CHECK (token_amount > 0)
- `chk_exchange_rate_positive`: CHECK (exchange_rate > 0)

**Indexes:**

- `idx_deposits_user`: user_id
- `idx_deposits_wallet`: wallet_id
- `idx_deposits_status_created`: (status_id, created_at DESC) - For pending deposits queries
- `idx_deposits_stripe_payment`: stripe_payment_intent_id
- `idx_deposits_blockchain_tx`: blockchain_tx_id
- `idx_deposits_created`: created_at DESC

#### blockchain_transactions

Immutable on-chain transaction records.

| Column              | Type          | Constraints                                | Notes                                       |
| ------------------- | ------------- | ------------------------------------------ | ------------------------------------------- |
| id                  | BIGINT        | PRIMARY KEY, GENERATED ALWAYS AS IDENTITY  | Internal ID                                 |
| public_id           | UUID          | NOT NULL, UNIQUE, DEFAULT uuidv7()         | API-exposed ID                              |
| network_id          | INT           | NOT NULL, REFERENCES networks(id)          | Network FK                                  |
| transaction_type_id | INT           | NOT NULL, REFERENCES transaction_types(id) | Type FK                                     |
| from_address        | VARCHAR(42)   | NOT NULL                                   | Sender address                              |
| to_address          | VARCHAR(42)   | NOT NULL                                   | Recipient address                           |
| tx_hash             | VARCHAR(66)   | NOT NULL                                   | Transaction hash                            |
| block_number        | BIGINT        |                                            | Block number                                |
| block_hash          | VARCHAR(66)   |                                            | Block hash                                  |
| amount              | NUMERIC(78,0) | NOT NULL                                   | Token amount (wei)                          |
| nonce               | BIGINT        |                                            | Transaction nonce (for debugging stuck txs) |
| gas_used            | BIGINT        |                                            | Gas consumed                                |
| gas_price_wei       | NUMERIC(78,0) |                                            | Gas price (wei)                             |
| is_confirmed        | BOOLEAN       | NOT NULL, DEFAULT FALSE                    | Confirmation status                         |
| confirmations       | INT           | NOT NULL, DEFAULT 0                        | Number of confirmations                     |
| created_at          | TIMESTAMPTZ   | NOT NULL, DEFAULT NOW()                    | Submission timestamp                        |
| confirmed_at        | TIMESTAMPTZ   |                                            | Confirmation timestamp                      |

**Constraints:**

- `uq_tx_hash_network`: UNIQUE (tx_hash, network_id)
- `chk_tx_hash`: CHECK (tx_hash ~\* '^0x[a-fA-F0-9]{64}$')
- `chk_from_address`: CHECK (from_address ~\* '^0x[a-fA-F0-9]{40}$')
- `chk_to_address`: CHECK (to_address ~\* '^0x[a-fA-F0-9]{40}$')
- `chk_amount_nonnegative`: CHECK (amount >= 0)
- `chk_confirmations_nonnegative`: CHECK (confirmations >= 0)
- `chk_nonce_nonnegative`: CHECK (nonce IS NULL OR nonce >= 0)

**Indexes:**

- `idx_blockchain_tx_network`: network_id
- `idx_blockchain_tx_type`: transaction_type_id
- `idx_blockchain_tx_from`: LOWER(from_address)
- `idx_blockchain_tx_to`: LOWER(to_address)
- `idx_blockchain_tx_block`: (network_id, block_number)
- `idx_blockchain_tx_unconfirmed`: created_at WHERE is_confirmed = FALSE
- `idx_blockchain_tx_nonce`: (network_id, from_address, nonce) WHERE is_confirmed = FALSE

---

### 6. Audit & Compliance Tables

#### audit_logs

Immutable audit trail for all sensitive operations.

| Column      | Type         | Constraints                               | Notes                                     |
| ----------- | ------------ | ----------------------------------------- | ----------------------------------------- |
| id          | BIGINT       | PRIMARY KEY, GENERATED ALWAYS AS IDENTITY | Internal ID                               |
| public_id   | UUID         | NOT NULL, UNIQUE, DEFAULT uuidv7()        | API-exposed ID                            |
| user_id     | BIGINT       | REFERENCES users(id)                      | Acting user FK                            |
| session_id  | BIGINT       | REFERENCES sessions(id)                   | Session FK                                |
| action      | VARCHAR(100) | NOT NULL                                  | Action type (e.g., 'users.created')       |
| entity_type | VARCHAR(100) | NOT NULL                                  | Table name                                |
| entity_id   | BIGINT       |                                           | Affected record ID                        |
| old_values  | JSONB        |                                           | Previous state                            |
| new_values  | JSONB        |                                           | New state                                 |
| metadata    | JSONB        |                                           | Additional context (IP, user agent, etc.) |
| created_at  | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()                   | Event timestamp                           |

**Indexes:**

- `idx_audit_user`: user_id
- `idx_audit_session`: session_id
- `idx_audit_entity`: (entity_type, entity_id)
- `idx_audit_action`: action
- `idx_audit_created`: created_at DESC
- `idx_audit_recent`: (entity_type, created_at DESC) WHERE created_at > NOW() - INTERVAL '30 days'
- `idx_audit_metadata_gin`: GIN INDEX ON metadata

#### blacklisted_addresses

Immutable compliance blocklist for suspicious addresses.

| Column           | Type         | Constraints                               | Notes                                      |
| ---------------- | ------------ | ----------------------------------------- | ------------------------------------------ |
| id               | BIGINT       | PRIMARY KEY, GENERATED ALWAYS AS IDENTITY | Internal ID                                |
| public_id        | UUID         | NOT NULL, UNIQUE, DEFAULT uuidv7()        | API-exposed ID                             |
| address          | VARCHAR(42)  | NOT NULL                                  | Blacklisted address                        |
| network_id       | INT          | REFERENCES networks(id)                   | Network FK (NULL = all networks)           |
| reason           | TEXT         | NOT NULL                                  | Why address was blocked                    |
| source           | VARCHAR(100) |                                           | Source ('OFAC', 'internal', 'chainalysis') |
| added_by_user_id | BIGINT       | REFERENCES users(id)                      | Admin who added                            |
| created_at       | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()                   | Block timestamp                            |
| expires_at       | TIMESTAMPTZ  |                                           | Expiration (NULL = permanent)              |

**Constraints:**

- `chk_blacklist_address`: CHECK (address ~\* '^0x[a-fA-F0-9]{40}$')

**Indexes:**

- `idx_blacklist_address_network_unique`: UNIQUE INDEX ON (LOWER(address), network_id) - Case-insensitive matching
- `idx_blacklist_network`: network_id
- `idx_blacklist_active`: LOWER(address) WHERE expires_at IS NULL OR expires_at > NOW()

#### webhook_events

Immutable Stripe webhook event log for debugging and replay.

| Column           | Type         | Constraints                               | Notes                                     |
| ---------------- | ------------ | ----------------------------------------- | ----------------------------------------- |
| id               | BIGINT       | PRIMARY KEY, GENERATED ALWAYS AS IDENTITY | Internal ID                               |
| public_id        | UUID         | NOT NULL, UNIQUE, DEFAULT uuidv7()        | API-exposed ID                            |
| stripe_event_id  | VARCHAR(255) | NOT NULL, UNIQUE                          | Stripe's event ID                         |
| event_type       | VARCHAR(100) | NOT NULL                                  | Event type ('checkout.session.completed') |
| api_version      | VARCHAR(20)  |                                           | Stripe API version                        |
| payload          | JSONB        | NOT NULL                                  | Full event payload                        |
| processed_at     | TIMESTAMPTZ  |                                           | When processed                            |
| processing_error | TEXT         |                                           | Error message if failed                   |
| retry_count      | INT          | NOT NULL, DEFAULT 0                       | Retry attempts                            |
| created_at       | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()                   | Receipt timestamp                         |

**Constraints:**

- `chk_retry_count`: CHECK (retry_count >= 0)

**Indexes:**

- `idx_webhook_type`: event_type
- `idx_webhook_created`: created_at DESC
- `idx_webhook_unprocessed`: created_at WHERE processed_at IS NULL
- `idx_webhook_failed`: created_at WHERE processing_error IS NOT NULL

---

## Database Functions & Triggers

### Audit Trigger Function

```sql
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id BIGINT;
  current_session_id BIGINT;
BEGIN
  -- Get current user/session from application context
  current_user_id := NULLIF(current_setting('app.current_user_id', true), '')::BIGINT;
  current_session_id := NULLIF(current_setting('app.current_session_id', true), '')::BIGINT;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (
      user_id, session_id, action, entity_type, entity_id, new_values, created_at
    ) VALUES (
      current_user_id, current_session_id,
      TG_TABLE_NAME || '.created', TG_TABLE_NAME, NEW.id,
      to_jsonb(NEW) - 'password', NOW()
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD IS DISTINCT FROM NEW THEN
      INSERT INTO audit_logs (
        user_id, session_id, action, entity_type, entity_id,
        old_values, new_values, created_at
      ) VALUES (
        current_user_id, current_session_id,
        TG_TABLE_NAME || '.updated', TG_TABLE_NAME, NEW.id,
        to_jsonb(OLD) - 'password', to_jsonb(NEW) - 'password', NOW()
      );
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (
      user_id, session_id, action, entity_type, entity_id, old_values, created_at
    ) VALUES (
      current_user_id, current_session_id,
      TG_TABLE_NAME || '.deleted', TG_TABLE_NAME, OLD.id,
      to_jsonb(OLD) - 'password', NOW()
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Trigger Applications

```sql
-- Audit triggers
CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_wallets AFTER INSERT OR UPDATE OR DELETE ON wallets
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_deposits AFTER INSERT OR UPDATE ON deposits
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_blockchain_transactions AFTER INSERT OR UPDATE ON blockchain_transactions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_user_roles AFTER INSERT OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
```

### updated_at Trigger Function

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to mutable tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## Entity Relationships

```text
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  kyc_statuses   │     │     roles       │     │    networks     │
│     (lookup)    │     │     (RBAC)      │     │   (lookup)      │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │ FK                    │                       │ FK
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     users       │◄────│   user_roles    │     │    wallets      │
│  BIGINT id      │  N:M│  (junction)     │     │                 │
│  UUID public_id │     └─────────────────┘     └────────┬────────┘
└────────┬────────┘                                      │
         │                                               │
         │                                               ▼
         │                                      ┌─────────────────┐
         │                                      │    deposits     │
         │                                      │  (immutable)    │
         │                                      └────────┬────────┘
         │                                               │
         ▼                                               ▼
┌─────────────────┐                             ┌─────────────────┐
│    sessions     │                             │  blockchain_    │
│   accounts      │                             │  transactions   │
│  verifications  │                             │  (immutable)    │
└─────────────────┘                             └─────────────────┘
```

---

## Optional Tables (Deferred Implementation)

The following tables are included in the schema for future use but implementation is deferred. Will need to be tweaked and updated in the future:

### withdrawals

Token-to-fiat withdrawal records (burn tokens → receive fiat).

**Status:** Schema ready, implementation deferred

| Column            | Type          | Constraints                                   | Notes                                   |
| ----------------- | ------------- | --------------------------------------------- | --------------------------------------- |
| id                | BIGINT        | PRIMARY KEY, GENERATED ALWAYS AS IDENTITY     | Internal ID                             |
| public_id         | UUID          | NOT NULL, UNIQUE, DEFAULT uuidv7()            | API-exposed ID                          |
| user_id           | BIGINT        | NOT NULL, REFERENCES users(id)                | User FK                                 |
| wallet_id         | BIGINT        | NOT NULL, REFERENCES wallets(id)              | Source wallet FK                        |
| status_id         | INT           | NOT NULL, REFERENCES transaction_statuses(id) | Withdrawal status                       |
| token_amount      | NUMERIC(78,0) | NOT NULL                                      | Tokens burned (wei)                     |
| fiat_amount_cents | BIGINT        | NOT NULL                                      | Fiat amount in cents                    |
| fee_cents         | BIGINT        | NOT NULL, DEFAULT 0                           | Fee in cents                            |
| exchange_rate     | NUMERIC(19,8) | NOT NULL                                      | Rate at time of withdrawal              |
| payout_method     | VARCHAR(50)   |                                               | 'bank_transfer', 'paypal', etc.         |
| payout_reference  | TEXT          |                                               | Encrypted payout details or external ID |
| blockchain_tx_id  | BIGINT        | REFERENCES blockchain_transactions(id)        | Burn transaction                        |
| stripe_payout_id  | VARCHAR(255)  |                                               | Stripe Connect payout ID                |
| created_at        | TIMESTAMPTZ   | NOT NULL, DEFAULT NOW()                       | Creation timestamp                      |
| completed_at      | TIMESTAMPTZ   |                                               | Completion timestamp                    |

**Constraints:**

- `chk_withdrawal_token_positive`: CHECK (token_amount > 0)
- `chk_withdrawal_fiat_positive`: CHECK (fiat_amount_cents > 0)
- `chk_withdrawal_fee_nonnegative`: CHECK (fee_cents >= 0)

**Indexes:**

- `idx_withdrawals_user`: user_id
- `idx_withdrawals_wallet`: wallet_id
- `idx_withdrawals_status`: status_id
- `idx_withdrawals_blockchain_tx`: blockchain_tx_id
- `idx_withdrawals_created`: created_at DESC

---

### kyc_documents

KYC verification documents storage.

**Status:** Schema ready, implementation deferred

| Column              | Type        | Constraints                               | Notes                                         |
| ------------------- | ----------- | ----------------------------------------- | --------------------------------------------- |
| id                  | BIGINT      | PRIMARY KEY, GENERATED ALWAYS AS IDENTITY | Internal ID                                   |
| public_id           | UUID        | NOT NULL, UNIQUE, DEFAULT uuidv7()        | API-exposed ID                                |
| user_id             | BIGINT      | NOT NULL, REFERENCES users(id)            | User FK                                       |
| document_type       | VARCHAR(50) | NOT NULL                                  | 'passport', 'drivers_license', 'utility_bill' |
| file_url            | TEXT        | NOT NULL                                  | S3/R2 URL (encrypted)                         |
| file_hash           | VARCHAR(64) |                                           | SHA-256 for integrity                         |
| verified_at         | TIMESTAMPTZ |                                           | When verified                                 |
| verified_by_user_id | BIGINT      | REFERENCES users(id)                      | Admin who verified                            |
| rejection_reason    | TEXT        |                                           | If rejected                                   |
| created_at          | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()                   | Upload timestamp                              |
| updated_at          | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()                   | Last update                                   |
| deleted_at          | TIMESTAMPTZ |                                           | Soft delete                                   |
| expires_at          | TIMESTAMPTZ |                                           | Document expiry                               |

**Indexes:**

- `idx_kyc_docs_user`: user_id WHERE deleted_at IS NULL
- `idx_kyc_docs_verified`: verified_at
- `idx_kyc_docs_expires`: expires_at

---

### token_balances

Cached on-chain token balances for fast dashboard reads.

**Status:** Schema ready, implementation deferred

| Column            | Type          | Constraints                               | Notes               |
| ----------------- | ------------- | ----------------------------------------- | ------------------- |
| id                | BIGINT        | PRIMARY KEY, GENERATED ALWAYS AS IDENTITY | Internal ID         |
| wallet_id         | BIGINT        | NOT NULL, REFERENCES wallets(id)          | Wallet FK           |
| network_id        | INT           | NOT NULL, REFERENCES networks(id)         | Network FK          |
| balance           | NUMERIC(78,0) | NOT NULL, DEFAULT 0                       | Token balance (wei) |
| last_synced_block | BIGINT        |                                           | Last block synced   |
| last_synced_at    | TIMESTAMPTZ   | NOT NULL, DEFAULT NOW()                   | Last sync timestamp |
| updated_at        | TIMESTAMPTZ   | NOT NULL, DEFAULT NOW()                   | Last update         |

**Constraints:**

- `uq_balance_wallet_network`: UNIQUE (wallet_id, network_id)
- `chk_balance_nonnegative`: CHECK (balance >= 0)

**Indexes:**

- `idx_token_balances_wallet`: wallet_id
- `idx_token_balances_network`: network_id
- `idx_token_balances_synced`: last_synced_at

---

## Implementation Notes

### Better-Auth Configuration

```typescript
// auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  user: {
    modelName: "users",
    additionalFields: {
      publicId: { type: "string", required: true },
      kycStatusId: { type: "number", required: true, input: false },
      depositLimitCents: {
        type: "number",
        required: false,
        defaultValue: 100000,
      },
      kycVerifiedAt: { type: "date", required: false, input: false },
      deletedAt: { type: "date", required: false, input: false },
    },
  },
  advanced: {
    database: {
      generateId: false, // Let PostgreSQL generate BIGINT IDs
    },
  },
});
```

### Setting Audit Context

```typescript
// Before database operations
await db.transaction(async (tx) => {
  await tx.execute(
    sql`SET LOCAL app.current_user_id = ${userId}; SET LOCAL app.current_session_id = ${sessionId};`,
  );
  // ... performs audited operations within this transaction
});
```

---

## Migration Order

1. **Lookup tables** (no dependencies): `kyc_statuses`, `transaction_statuses`, `transaction_types`, `networks`
2. **RBAC tables** (no dependencies): `roles`
3. **Auth tables** (depend on lookups): `users`, `sessions`, `accounts`, `verifications`
4. **Junction tables** (depend on users/roles): `user_roles`
5. **User data** (depends on users/networks): `wallets`
6. **Financial tables** (depend on users/wallets): `deposits`, `blockchain_transactions`
7. **Compliance tables** (depend on users/sessions): `audit_logs`, `blacklisted_addresses`, `webhook_events`
8. **Optional tables** (depend on core tables): `withdrawals`, `kyc_documents`, `token_balances`
9. **Seed data**: Insert lookup values
10. **Triggers**: Create audit and updated_at triggers
11. **Indexes**: Verify all indexes created

---

## Index Summary

Total: ~51 indexes across 21 tables (18 core + 3 optional)

**Optimization Applied:**

- Removed redundant indexes where UNIQUE constraints exist
- Added GIN index for JSONB metadata queries
- Used case-insensitive UNIQUE INDEX for address matching
- Partial indexes for common filtered queries

---

_Last Updated: February 2026_
_Schema Version: 1.1_
