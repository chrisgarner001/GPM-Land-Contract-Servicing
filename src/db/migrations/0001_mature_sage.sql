CREATE TYPE "public"."allocation_type" AS ENUM('PRINCIPAL', 'INTEREST', 'ESCROW_TAX', 'ESCROW_INSURANCE', 'LATE_FEE', 'OTHER_FEE', 'SUSPENSE');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('CHECK', 'CASH', 'ACH', 'CARD', 'ADJUSTMENT', 'LEGACY_IMPORT');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'CLEARED', 'REVERSED', 'NSF');--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"allocation_type" "allocation_type" NOT NULL,
	"amount_cents" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"received_date" date NOT NULL,
	"amount_cents" bigint NOT NULL,
	"payment_method" "payment_method" DEFAULT 'LEGACY_IMPORT' NOT NULL,
	"reference_number" text,
	"status" "payment_status" DEFAULT 'CLEARED' NOT NULL,
	"external_platform_ref" text,
	"reversed_payment_id" uuid,
	"legacy_description" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "trust_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"transaction_date" date NOT NULL,
	"reference" text,
	"payee_or_payer_name" text,
	"description" text,
	"amount_paid_out_cents" bigint,
	"amount_received_cents" bigint,
	"balance_cents" bigint
);
--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_ledger_entries" ADD CONSTRAINT "trust_ledger_entries_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;