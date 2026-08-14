CREATE TYPE "public"."party_type" AS ENUM('INDIVIDUAL', 'BUSINESS');--> statement-breakpoint
CREATE TYPE "public"."contract_party_role" AS ENUM('BUYER', 'CO_BUYER', 'SELLER', 'CO_SELLER', 'INVESTOR_PAYEE');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('ACTIVE', 'PAID_OFF', 'DEFAULTED', 'CANCELLED', 'IN_FORECLOSURE');--> statement-breakpoint
CREATE TYPE "public"."interest_method" AS ENUM('SIMPLE_30_360', 'SIMPLE_ACTUAL_365');--> statement-breakpoint
CREATE TYPE "public"."payment_frequency" AS ENUM('MONTHLY', 'SEMI_MONTHLY', 'BIWEEKLY');--> statement-breakpoint
CREATE TABLE "parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_type" "party_type" NOT NULL,
	"display_name" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"company_name" text,
	"email" text,
	"phone" text,
	"mailing_address_line1" text,
	"mailing_address_line2" text,
	"mailing_city" text,
	"mailing_state" text,
	"mailing_zip" text,
	"tax_id_last4" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"street_address" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"zip" text NOT NULL,
	"county" text NOT NULL,
	"parcel_number" text,
	"legal_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"role" "contract_party_role" NOT NULL,
	"ownership_percent" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contract_parties_contract_id_party_id_role_unique" UNIQUE("contract_id","party_id","role")
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_number" text NOT NULL,
	"property_id" uuid NOT NULL,
	"purchase_price_cents" bigint NOT NULL,
	"down_payment_cents" bigint NOT NULL,
	"original_principal_cents" bigint NOT NULL,
	"current_principal_balance_cents" bigint NOT NULL,
	"interest_rate_annual" numeric(7, 4) NOT NULL,
	"interest_method" "interest_method" DEFAULT 'SIMPLE_30_360' NOT NULL,
	"amortization_term_months" integer NOT NULL,
	"payment_amount_cents" bigint NOT NULL,
	"payment_frequency" "payment_frequency" DEFAULT 'MONTHLY' NOT NULL,
	"origination_date" date NOT NULL,
	"first_payment_date" date NOT NULL,
	"maturity_date" date,
	"has_balloon" boolean DEFAULT false NOT NULL,
	"balloon_amount_cents" bigint,
	"balloon_due_date" date,
	"late_fee_amount_cents" bigint,
	"late_fee_grace_days" integer,
	"escrow_required" boolean DEFAULT false NOT NULL,
	"status" "contract_status" DEFAULT 'ACTIVE' NOT NULL,
	"status_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contracts_contract_number_unique" UNIQUE("contract_number")
);
--> statement-breakpoint
CREATE TABLE "amortization_schedule_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"effective_date" date NOT NULL,
	"reason" text NOT NULL,
	"principal_balance_at_start_cents" bigint NOT NULL,
	"interest_rate_annual" numeric(7, 4) NOT NULL,
	"amortization_term_months" integer NOT NULL,
	"number_of_payments" integer NOT NULL,
	"payment_amount_cents" bigint NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scheduled_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_version_id" uuid NOT NULL,
	"period_number" integer NOT NULL,
	"due_date" date NOT NULL,
	"beginning_balance_cents" bigint NOT NULL,
	"scheduled_interest_cents" bigint NOT NULL,
	"scheduled_principal_cents" bigint NOT NULL,
	"scheduled_escrow_cents" bigint,
	"scheduled_total_cents" bigint NOT NULL,
	"ending_balance_cents" bigint NOT NULL,
	CONSTRAINT "scheduled_payments_schedule_version_id_period_number_unique" UNIQUE("schedule_version_id","period_number")
);
--> statement-breakpoint
ALTER TABLE "contract_parties" ADD CONSTRAINT "contract_parties_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_parties" ADD CONSTRAINT "contract_parties_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amortization_schedule_versions" ADD CONSTRAINT "amortization_schedule_versions_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_payments" ADD CONSTRAINT "scheduled_payments_schedule_version_id_amortization_schedule_versions_id_fk" FOREIGN KEY ("schedule_version_id") REFERENCES "public"."amortization_schedule_versions"("id") ON DELETE no action ON UPDATE no action;