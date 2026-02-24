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
	"required_confirmations" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "uq_blockchain_tx_hash_network" UNIQUE("tx_hash","network_id"),
	CONSTRAINT "chk_blockchain_tx_hash_format" CHECK ("tx_hash" ~* '^0x[a-fA-F0-9]{64}$'),
	CONSTRAINT "chk_blockchain_from_address" CHECK ("from_address" ~* '^0x[a-fA-F0-9]{40}$'),
	CONSTRAINT "chk_blockchain_to_address" CHECK ("to_address" ~* '^0x[a-fA-F0-9]{40}$'),
	CONSTRAINT "chk_blockchain_amount_nonnegative" CHECK ("amount" >= 0),
	CONSTRAINT "chk_blockchain_confirmations_nonnegative" CHECK ("confirmations" >= 0),
	CONSTRAINT "chk_blockchain_nonce_nonnegative" CHECK ("nonce" IS NULL OR "nonce" >= 0),
	CONSTRAINT "chk_blockchain_required_confirmations" CHECK ("required_confirmations" > 0)
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
	CONSTRAINT "chk_wallets_type" CHECK ("wallet_type" IN ('CUSTODIAL', 'EXTERNAL'))
);
--> statement-breakpoint
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
CREATE UNIQUE INDEX "uq_wallets_primary" ON "wallets" ("user_id","network_id") WHERE "is_primary" = TRUE AND "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_idx_wallets_address_network" ON "wallets" (LOWER("address"),"network_id","deleted_at");--> statement-breakpoint
CREATE INDEX "idx_wallets_user" ON "wallets" ("user_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_wallets_network" ON "wallets" ("network_id");--> statement-breakpoint
CREATE INDEX "idx_wallets_type" ON "wallets" ("wallet_type");--> statement-breakpoint
CREATE INDEX "idx_wallets_provider" ON "wallets" ("provider_name");--> statement-breakpoint
ALTER TABLE "blockchain_transactions" ADD CONSTRAINT "blockchain_transactions_network_id_networks_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id");--> statement-breakpoint
ALTER TABLE "blockchain_transactions" ADD CONSTRAINT "blockchain_transactions_L9dzqeVBgLt1_fkey" FOREIGN KEY ("transaction_type_id") REFERENCES "transaction_types"("id");--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_wallet_id_wallets_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id");--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_status_id_transaction_statuses_id_fkey" FOREIGN KEY ("status_id") REFERENCES "transaction_statuses"("id");--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_blockchain_tx_id_blockchain_transactions_id_fkey" FOREIGN KEY ("blockchain_tx_id") REFERENCES "blockchain_transactions"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_user_id_users_id_fkey" FOREIGN KEY ("granted_by_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_network_id_networks_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id");