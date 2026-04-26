CREATE TABLE "withdrawals" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "withdrawals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT uuidv7() NOT NULL UNIQUE,
	"user_id" bigint NOT NULL,
	"wallet_id" bigint NOT NULL,
	"status_id" integer NOT NULL,
	"token_amount" numeric(78,0) NOT NULL,
	"fiat_amount_cents" bigint NOT NULL,
	"fee_cents" bigint DEFAULT 0 NOT NULL,
	"net_amount_cents" bigint GENERATED ALWAYS AS (fiat_amount_cents - fee_cents) STORED,
	"exchange_rate" numeric(19,8) DEFAULT '1.0' NOT NULL,
	"payout_method" varchar(50),
	"payout_reference" text,
	"blockchain_tx_id" bigint,
	"stripe_transfer_id" varchar(255),
	"stripe_payout_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "chk_withdrawal_token_positive" CHECK ("token_amount" > 0),
	CONSTRAINT "chk_withdrawal_fiat_positive" CHECK ("fiat_amount_cents" > 0),
	CONSTRAINT "chk_withdrawal_fee_nonnegative" CHECK ("fee_cents" >= 0),
	CONSTRAINT "chk_withdrawal_fee_lte_fiat" CHECK ("fee_cents" <= "fiat_amount_cents")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_connect_account_id" varchar(255);--> statement-breakpoint
CREATE INDEX "idx_withdrawals_user" ON "withdrawals" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_withdrawals_wallet" ON "withdrawals" ("wallet_id");--> statement-breakpoint
CREATE INDEX "idx_withdrawals_status" ON "withdrawals" ("status_id");--> statement-breakpoint
CREATE INDEX "idx_withdrawals_blockchain_tx" ON "withdrawals" ("blockchain_tx_id");--> statement-breakpoint
CREATE INDEX "idx_withdrawals_created" ON "withdrawals" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_withdrawals_stripe_transfer_id" ON "withdrawals" ("stripe_transfer_id") WHERE "stripe_transfer_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_withdrawals_stripe_payout_id" ON "withdrawals" ("stripe_payout_id") WHERE "stripe_payout_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_wallet_id_wallets_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id");--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_status_id_transaction_statuses_id_fkey" FOREIGN KEY ("status_id") REFERENCES "transaction_statuses"("id");--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_blockchain_tx_id_blockchain_transactions_id_fkey" FOREIGN KEY ("blockchain_tx_id") REFERENCES "blockchain_transactions"("id");