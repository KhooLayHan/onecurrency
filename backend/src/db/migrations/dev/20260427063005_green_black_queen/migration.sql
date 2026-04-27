CREATE TABLE "transfers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transfers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT uuidv7() NOT NULL UNIQUE,
	"sender_user_id" bigint NOT NULL,
	"receiver_user_id" bigint NOT NULL,
	"sender_wallet_id" bigint NOT NULL,
	"receiver_wallet_id" bigint NOT NULL,
	"status_id" integer NOT NULL,
	"amount_cents" bigint NOT NULL,
	"fee_cents" bigint DEFAULT 0 NOT NULL,
	"net_amount_cents" bigint GENERATED ALWAYS AS (amount_cents - fee_cents) STORED,
	"token_amount" numeric(78,0) NOT NULL,
	"blockchain_tx_id" bigint,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "chk_transfers_amount_positive" CHECK ("amount_cents" > 0),
	CONSTRAINT "chk_transfers_fee_nonnegative" CHECK ("fee_cents" >= 0),
	CONSTRAINT "chk_transfers_fee_lte_amount" CHECK ("fee_cents" <= "amount_cents"),
	CONSTRAINT "chk_transfers_token_positive" CHECK ("token_amount" > 0),
	CONSTRAINT "chk_transfers_no_self_transfer" CHECK ("sender_user_id" != "receiver_user_id")
);
--> statement-breakpoint
CREATE INDEX "idx_transfers_sender" ON "transfers" ("sender_user_id");--> statement-breakpoint
CREATE INDEX "idx_transfers_receiver" ON "transfers" ("receiver_user_id");--> statement-breakpoint
CREATE INDEX "idx_transfers_status" ON "transfers" ("status_id");--> statement-breakpoint
CREATE INDEX "idx_transfers_blockchain_tx" ON "transfers" ("blockchain_tx_id");--> statement-breakpoint
CREATE INDEX "idx_transfers_created" ON "transfers" ("created_at");--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_sender_user_id_users_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_receiver_user_id_users_id_fkey" FOREIGN KEY ("receiver_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_sender_wallet_id_wallets_id_fkey" FOREIGN KEY ("sender_wallet_id") REFERENCES "wallets"("id");--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_receiver_wallet_id_wallets_id_fkey" FOREIGN KEY ("receiver_wallet_id") REFERENCES "wallets"("id");--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_status_id_transaction_statuses_id_fkey" FOREIGN KEY ("status_id") REFERENCES "transaction_statuses"("id");--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_blockchain_tx_id_blockchain_transactions_id_fkey" FOREIGN KEY ("blockchain_tx_id") REFERENCES "blockchain_transactions"("id");