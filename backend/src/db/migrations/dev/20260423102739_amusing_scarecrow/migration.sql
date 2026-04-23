CREATE TABLE "kyc_submissions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "kyc_submissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT uuidv7() NOT NULL UNIQUE,
	"user_id" bigint NOT NULL,
	"kyc_status_id" bigint NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"date_of_birth" date NOT NULL,
	"nationality" varchar(2) NOT NULL,
	"document_type" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_kyc_submissions_user" ON "kyc_submissions" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_submissions_submitted" ON "kyc_submissions" ("id");--> statement-breakpoint
ALTER TABLE "kyc_submissions" ADD CONSTRAINT "kyc_submissions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "kyc_submissions" ADD CONSTRAINT "kyc_submissions_kyc_status_id_kyc_statuses_id_fkey" FOREIGN KEY ("kyc_status_id") REFERENCES "kyc_statuses"("id");