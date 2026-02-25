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
ALTER TABLE "blockchain_transactions" DROP CONSTRAINT "chk_blockchain_required_confirmations";--> statement-breakpoint
ALTER TABLE "blockchain_transactions" DROP COLUMN "required_confirmations";--> statement-breakpoint
DROP INDEX "uq_idx_wallets_address_network";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_idx_wallets_address_network" ON "wallets" (LOWER("address"),"network_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
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
CREATE INDEX "idx_blacklist_active" ON "blacklisted_addresses" (LOWER("address")) WHERE "expires_at" IS NULL OR "expires_at" > CURRENT_TIMESTAMP;--> statement-breakpoint
CREATE INDEX "idx_webhook_event_type" ON "webhook_events" ("event_type");--> statement-breakpoint
CREATE INDEX "idx_webhook_stripe_event" ON "webhook_events" ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_created" ON "webhook_events" ("created_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_unprocessed" ON "webhook_events" ("created_at") WHERE "processed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_webhook_failed" ON "webhook_events" ("created_at") WHERE "processing_error" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_session_id_sessions_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "blacklisted_addresses" ADD CONSTRAINT "blacklisted_addresses_network_id_networks_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id");--> statement-breakpoint
ALTER TABLE "blacklisted_addresses" ADD CONSTRAINT "blacklisted_addresses_added_by_user_id_users_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_blockchain_tx_id_blockchain_transactions_id_fkey" FOREIGN KEY ("blockchain_tx_id") REFERENCES "blockchain_transactions"("id");--> statement-breakpoint
ALTER TABLE "blockchain_transactions" ADD CONSTRAINT "chk_blockchain_block_number_nonnegative" CHECK ("block_number" IS NULL OR "block_number" >= 0);--> statement-breakpoint
ALTER TABLE "blockchain_transactions" ADD CONSTRAINT "chk_blockchain_gas_used_nonnegative" CHECK ("gas_used" IS NULL OR "gas_used" >= 0);--> statement-breakpoint
ALTER TABLE "blockchain_transactions" ADD CONSTRAINT "chk_blockchain_gas_price_nonnegative" CHECK ("gas_price_wei" IS NULL OR "gas_price_wei" >= 0);--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "chk_wallets_encrypted_key" CHECK (("wallet_type" = 'CUSTODIAL' AND "encrypted_private_key" IS NOT NULL)
          OR ("wallet_type" = 'EXTERNAL' AND "encrypted_private_key" IS NULL));