CREATE TYPE "public"."escrow_analysis_status" AS ENUM('DRAFT', 'FINALIZED', 'SENT');--> statement-breakpoint
CREATE TYPE "public"."escrow_analysis_trigger" AS ENUM('SEMI_ANNUAL_SCHEDULED', 'LARGE_BILL_RECEIVED', 'ONBOARDING', 'MANUAL');--> statement-breakpoint
CREATE TABLE "escrow_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"analysis_date" date NOT NULL,
	"effective_date" date NOT NULL,
	"trigger" "escrow_analysis_trigger" NOT NULL,
	"projection_period_months" numeric(3, 0) DEFAULT '12' NOT NULL,
	"cushion_percent" numeric(5, 2) DEFAULT '5.00' NOT NULL,
	"projected_annual_tax_cents" bigint NOT NULL,
	"projected_annual_insurance_cents" bigint NOT NULL,
	"cushion_target_cents" bigint NOT NULL,
	"current_escrow_balance_cents" bigint NOT NULL,
	"current_monthly_escrow_payment_cents" bigint NOT NULL,
	"projected_ending_balance_cents" bigint NOT NULL,
	"shortage_or_surplus_cents" bigint NOT NULL,
	"new_monthly_escrow_payment_cents" bigint NOT NULL,
	"status" "escrow_analysis_status" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "escrow_analyses" ADD CONSTRAINT "escrow_analyses_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;