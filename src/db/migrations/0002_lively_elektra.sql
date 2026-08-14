CREATE TYPE "public"."late_fee_type" AS ENUM('FLAT', 'PERCENT_OF_PI', 'PERCENT_OF_TOTAL_PAYMENT');--> statement-breakpoint
CREATE TYPE "public"."lien_priority" AS ENUM('1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."escrow_category" AS ENUM('RESERVE', 'IMPOUND');--> statement-breakpoint
CREATE TYPE "public"."voucher_frequency" AS ENUM('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'YEARLY');--> statement-breakpoint
CREATE TYPE "public"."voucher_type" AS ENUM('PROPERTY_TAX', 'HOMEOWNERS_INSURANCE', 'OTHER');--> statement-breakpoint
CREATE TABLE "escrow_vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"payee_name" text NOT NULL,
	"payee_reference" text,
	"description" text,
	"amount_cents" bigint NOT NULL,
	"frequency" "voucher_frequency" DEFAULT 'YEARLY' NOT NULL,
	"voucher_type" "voucher_type",
	"next_pay_date" date NOT NULL,
	"on_hold" boolean DEFAULT false NOT NULL,
	"discretionary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "lien_priority" "lien_priority" DEFAULT '1ST' NOT NULL;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "late_fee_type" "late_fee_type" DEFAULT 'FLAT' NOT NULL;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "late_fee_percent" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "trust_ledger_entries" ADD COLUMN "category" "escrow_category";--> statement-breakpoint
ALTER TABLE "trust_ledger_entries" ADD COLUMN "voucher_type" "voucher_type";--> statement-breakpoint
ALTER TABLE "escrow_vouchers" ADD CONSTRAINT "escrow_vouchers_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;