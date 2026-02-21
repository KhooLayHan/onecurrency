CREATE TABLE "kyc_statuses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "kyc_statuses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kyc_statuses_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "networks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "networks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT uuidv7() NOT NULL,
	"name" varchar(100) NOT NULL,
	"chain_id" bigint NOT NULL,
	"rpc_url" text,
	"explorer_url" text,
	"contract_address" varchar(42),
	"is_testnet" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "networks_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "networks_name_unique" UNIQUE("name"),
	CONSTRAINT "networks_chain_id_unique" UNIQUE("chain_id"),
	CONSTRAINT "chk_networks_contract_address_format" CHECK ("networks"."contract_address" IS NULL OR "networks"."contract_address" ~* '^0x[a-fA-F0-9]{40}$')
);
--> statement-breakpoint
CREATE TABLE "transaction_statuses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transaction_statuses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_statuses_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "transaction_types" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transaction_types_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE INDEX "idx_networks_active" ON "networks" USING btree ("is_active");