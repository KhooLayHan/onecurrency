CREATE TABLE "accounts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT uuidv7() NOT NULL UNIQUE,
	"user_id" bigint,
	"session_id" bigint,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" bigint,
	"old_values" jsonb,
	"new_values" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blacklisted_addresses" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "blacklisted_addresses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT uuidv7() NOT NULL UNIQUE,
	"address" varchar(42) NOT NULL,
	"network_id" integer,
	"reason" text NOT NULL,
	"source" varchar(100),
	"added_by_user_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "chk_blacklist_address_format" CHECK ("address" ~* '^0x[a-fA-F0-9]{40}$')
);
--> statement-breakpoint
CREATE TABLE "blockchain_transactions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "blockchain_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT uuidv7() NOT NULL UNIQUE,
	"network_id" integer NOT NULL,
	"transaction_type_id" integer NOT NULL,
	"from_address" varchar(42) NOT NULL,
	"to_address" varchar(42) NOT NULL,
	"tx_hash" varchar(66) NOT NULL,
	"block_number" bigint,
	"block_hash" varchar(66),
	"amount" numeric(78,0) NOT NULL,
	"nonce" bigint,
	"gas_used" bigint,
	"gas_price_wei" numeric(78,0),
	"is_confirmed" boolean DEFAULT false NOT NULL,
	"confirmations" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "uq_blockchain_tx_hash_network" UNIQUE("tx_hash","network_id"),
	CONSTRAINT "chk_blockchain_tx_hash_format" CHECK ("tx_hash" ~* '^0x[a-fA-F0-9]{64}$'),
	CONSTRAINT "chk_blockchain_from_address" CHECK ("from_address" ~* '^0x[a-fA-F0-9]{40}$'),
	CONSTRAINT "chk_blockchain_to_address" CHECK ("to_address" ~* '^0x[a-fA-F0-9]{40}$'),
	CONSTRAINT "chk_blockchain_amount_nonnegative" CHECK ("amount" >= 0),
	CONSTRAINT "chk_blockchain_block_number_nonnegative" CHECK ("block_number" IS NULL OR "block_number" >= 0),
	CONSTRAINT "chk_blockchain_gas_used_nonnegative" CHECK ("gas_used" IS NULL OR "gas_used" >= 0),
	CONSTRAINT "chk_blockchain_gas_price_nonnegative" CHECK ("gas_price_wei" IS NULL OR "gas_price_wei" >= 0),
	CONSTRAINT "chk_blockchain_confirmations_nonnegative" CHECK ("confirmations" >= 0),
	CONSTRAINT "chk_blockchain_nonce_nonnegative" CHECK ("nonce" IS NULL OR "nonce" >= 0)
);
--> statement-breakpoint
CREATE TABLE "deposits" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "deposits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT uuidv7() NOT NULL UNIQUE,
	"user_id" bigint NOT NULL,
	"wallet_id" bigint NOT NULL,
	"status_id" integer NOT NULL,
	"stripe_session_id" varchar(255) NOT NULL UNIQUE,
	"stripe_payment_intent_id" varchar(255) UNIQUE,
	"stripe_customer_id" varchar(255),
	"amount_cents" bigint NOT NULL,
	"fee_cents" bigint DEFAULT 0 NOT NULL,
	"net_amount_cents" bigint GENERATED ALWAYS AS (amount_cents - fee_cents) STORED,
	"token_amount" numeric(78,0) NOT NULL,
	"exchange_rate" numeric(19,8) DEFAULT '1.0' NOT NULL,
	"blockchain_tx_id" bigint,
	"idempotency_key" varchar(255) UNIQUE,
	"ip_address" inet,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "chk_deposits_amount_positive" CHECK ("amount_cents" > 0),
	CONSTRAINT "chk_deposits_fee_nonnegative" CHECK ("fee_cents" >= 0),
	CONSTRAINT "chk_deposits_fee_lte_amount" CHECK ("fee_cents" <= "amount_cents"),
	CONSTRAINT "chk_deposits_token_positive" CHECK ("token_amount" > 0),
	CONSTRAINT "chk_deposits_exchange_rate_positive" CHECK ("exchange_rate" > 0)
);
--> statement-breakpoint
CREATE TABLE "kyc_statuses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "kyc_statuses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL UNIQUE,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "networks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "networks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT uuidv7() NOT NULL UNIQUE,
	"name" varchar(100) NOT NULL UNIQUE,
	"chain_id" bigint NOT NULL UNIQUE,
	"rpc_url" text,
	"explorer_url" text,
	"contract_address" varchar(42),
	"is_testnet" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_networks_contract_address_format" CHECK ("contract_address" IS NULL OR "contract_address" ~* '^0x[a-fA-F0-9]{40}$')
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT uuidv7() NOT NULL UNIQUE,
	"name" varchar(100) NOT NULL UNIQUE,
	"description" text,
	"permissions" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"token" text NOT NULL UNIQUE,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_statuses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transaction_statuses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL UNIQUE,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_types" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transaction_types_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL UNIQUE,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"role_id" integer NOT NULL,
	"granted_by_user_id" bigint,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_user_role" UNIQUE("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"public_id" uuid DEFAULT uuidv7() NOT NULL UNIQUE,
	"kyc_status_id" integer DEFAULT 1 NOT NULL,
	"kyc_verified_at" timestamp with time zone,
	"deposit_limit_cents" bigint DEFAULT 100000 NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_deposit_limit" CHECK ("deposit_limit_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "verifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wallets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT uuidv7() NOT NULL UNIQUE,
	"user_id" bigint NOT NULL,
	"network_id" integer NOT NULL,
	"address" varchar(42) NOT NULL,
	"label" varchar(100),
	"is_primary" boolean DEFAULT false NOT NULL,
	"wallet_type" varchar(20) DEFAULT 'EXTERNAL' NOT NULL,
	"provider_name" varchar(50),
	"encrypted_private_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_wallets_address_format" CHECK ("address" ~* '^0x[a-fA-F0-9]{40}$'),
	CONSTRAINT "chk_wallets_type" CHECK ("wallet_type" IN ('CUSTODIAL', 'EXTERNAL')),
	CONSTRAINT "chk_wallets_encrypted_key" CHECK (("wallet_type" = 'CUSTODIAL' AND "encrypted_private_key" IS NOT NULL)
          OR ("wallet_type" = 'EXTERNAL' AND "encrypted_private_key" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "webhook_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT uuidv7() NOT NULL UNIQUE,
	"stripe_event_id" varchar(255) NOT NULL UNIQUE,
	"event_type" varchar(100) NOT NULL,
	"api_version" varchar(20),
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_error" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_webhook_retry_count" CHECK ("retry_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX "idx_accounts_user_id" ON "accounts" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_accounts_provider" ON "accounts" ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "idx_audit_user" ON "audit_logs" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_session" ON "audit_logs" ("session_id");--> statement-breakpoint
CREATE INDEX "idx_audit_entity" ON "audit_logs" ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_action" ON "audit_logs" ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_created" ON "audit_logs" ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_entity_created" ON "audit_logs" ("entity_type","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_metadata_gin" ON "audit_logs" USING gin ("metadata");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_blacklist_address_network" ON "blacklisted_addresses" (LOWER("address"),"network_id");--> statement-breakpoint
CREATE INDEX "idx_blacklist_network" ON "blacklisted_addresses" ("network_id");--> statement-breakpoint
CREATE INDEX "idx_blacklist_source" ON "blacklisted_addresses" ("source");--> statement-breakpoint
CREATE INDEX "idx_blacklist_active" ON "blacklisted_addresses" (LOWER("address"),"expires_at");--> statement-breakpoint
CREATE INDEX "idx_blockchain_tx_network" ON "blockchain_transactions" ("network_id");--> statement-breakpoint
CREATE INDEX "idx_blockchain_tx_type" ON "blockchain_transactions" ("transaction_type_id");--> statement-breakpoint
CREATE INDEX "idx_blockchain_tx_from" ON "blockchain_transactions" (LOWER("from_address"));--> statement-breakpoint
CREATE INDEX "idx_blockchain_tx_to" ON "blockchain_transactions" (LOWER("to_address"));--> statement-breakpoint
CREATE INDEX "idx_blockchain_tx_block" ON "blockchain_transactions" ("network_id","block_number");--> statement-breakpoint
CREATE INDEX "idx_blockchain_tx_unconfirmed" ON "blockchain_transactions" ("created_at") WHERE "is_confirmed" = FALSE;--> statement-breakpoint
CREATE INDEX "idx_blockchain_tx_nonce" ON "blockchain_transactions" ("network_id","from_address","nonce") WHERE "is_confirmed" = FALSE;--> statement-breakpoint
CREATE INDEX "idx_deposits_user" ON "deposits" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_deposits_wallet" ON "deposits" ("wallet_id");--> statement-breakpoint
CREATE INDEX "idx_deposits_status_created" ON "deposits" ("status_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_deposits_stripe_session" ON "deposits" ("stripe_session_id");--> statement-breakpoint
CREATE INDEX "idx_deposits_stripe_payment" ON "deposits" ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "idx_deposits_blockchain_tx" ON "deposits" ("blockchain_tx_id");--> statement-breakpoint
CREATE INDEX "idx_deposits_created" ON "deposits" ("created_at");--> statement-breakpoint
CREATE INDEX "idx_networks_active" ON "networks" ("is_active");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_id" ON "sessions" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires" ON "sessions" ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_user_roles_user" ON "user_roles" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_roles_role" ON "user_roles" ("role_id");--> statement-breakpoint
CREATE INDEX "idx_user_roles_granted_by" ON "user_roles" ("granted_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_email_active" ON "users" ("email") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_users_kyc_status" ON "users" ("kyc_status_id");--> statement-breakpoint
CREATE INDEX "idx_users_created" ON "users" ("created_at");--> statement-breakpoint
CREATE INDEX "idx_verifications_identifier" ON "verifications" ("identifier");--> statement-breakpoint
CREATE INDEX "idx_verifications_expires" ON "verifications" ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_wallets_primary" ON "wallets" ("user_id","network_id") WHERE "is_primary" = TRUE AND "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_idx_wallets_address_network" ON "wallets" (LOWER("address"),"network_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_wallets_user" ON "wallets" ("user_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_wallets_network" ON "wallets" ("network_id");--> statement-breakpoint
CREATE INDEX "idx_wallets_type" ON "wallets" ("wallet_type");--> statement-breakpoint
CREATE INDEX "idx_wallets_provider" ON "wallets" ("provider_name");--> statement-breakpoint
CREATE INDEX "idx_webhook_event_type" ON "webhook_events" ("event_type");--> statement-breakpoint
CREATE INDEX "idx_webhook_stripe_event" ON "webhook_events" ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_created" ON "webhook_events" ("created_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_unprocessed" ON "webhook_events" ("created_at") WHERE "processed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_webhook_failed" ON "webhook_events" ("created_at") WHERE "processing_error" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_session_id_sessions_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "blacklisted_addresses" ADD CONSTRAINT "blacklisted_addresses_network_id_networks_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id");--> statement-breakpoint
ALTER TABLE "blacklisted_addresses" ADD CONSTRAINT "blacklisted_addresses_added_by_user_id_users_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "blockchain_transactions" ADD CONSTRAINT "blockchain_transactions_network_id_networks_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id");--> statement-breakpoint
ALTER TABLE "blockchain_transactions" ADD CONSTRAINT "blockchain_transactions_L9dzqeVBgLt1_fkey" FOREIGN KEY ("transaction_type_id") REFERENCES "transaction_types"("id");--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_wallet_id_wallets_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id");--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_status_id_transaction_statuses_id_fkey" FOREIGN KEY ("status_id") REFERENCES "transaction_statuses"("id");--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_blockchain_tx_id_blockchain_transactions_id_fkey" FOREIGN KEY ("blockchain_tx_id") REFERENCES "blockchain_transactions"("id");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_user_id_users_id_fkey" FOREIGN KEY ("granted_by_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_kyc_status_id_kyc_statuses_id_fkey" FOREIGN KEY ("kyc_status_id") REFERENCES "kyc_statuses"("id");--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_network_id_networks_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id");