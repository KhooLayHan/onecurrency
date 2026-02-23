CREATE TABLE "roles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT uuidv7() NOT NULL UNIQUE,
	"name" varchar(100) NOT NULL UNIQUE,
	"description" text,
	"permissions" jsonb DEFAULT '[]' NOT NULL,
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
CREATE INDEX "idx_user_roles_user" ON "user_roles" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_roles_role" ON "user_roles" ("role_id");--> statement-breakpoint
CREATE INDEX "idx_user_roles_granted_by" ON "user_roles" ("granted_by_user_id");