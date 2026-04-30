CREATE TABLE "rate_limit" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rate_limit_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"key" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"last_request" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "two_factor_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kyc_submissions" ADD COLUMN "document_front_key" varchar(500);--> statement-breakpoint
ALTER TABLE "kyc_submissions" ADD COLUMN "document_back_key" varchar(500);--> statement-breakpoint
ALTER TABLE "kyc_submissions" ADD COLUMN "selfie_key" varchar(500);--> statement-breakpoint
ALTER TABLE "kyc_submissions" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "kyc_submissions" ADD COLUMN "reviewed_by_user_id" bigint;--> statement-breakpoint
ALTER TABLE "kyc_submissions" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "idempotency_key" varchar(36);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_kyc_submissions_status" ON "kyc_submissions" ("kyc_status_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rate_limit_key" ON "rate_limit" ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_transfers_sender_idempotency_key" ON "transfers" ("sender_user_id","idempotency_key") WHERE "idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_two_factor_user_id" ON "two_factor" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_two_factor_user_id" ON "two_factor" ("user_id");--> statement-breakpoint
ALTER TABLE "kyc_submissions" ADD CONSTRAINT "kyc_submissions_reviewed_by_user_id_users_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;