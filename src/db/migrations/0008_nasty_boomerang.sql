CREATE TABLE "vendor_disbursements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"transaction_date" date NOT NULL,
	"reference" text,
	"amount_cents" bigint NOT NULL,
	"servicing_fee_cents" bigint DEFAULT 0 NOT NULL,
	"interest_distribution_cents" bigint DEFAULT 0 NOT NULL,
	"principal_distribution_cents" bigint DEFAULT 0 NOT NULL,
	"charges_cents" bigint DEFAULT 0 NOT NULL,
	"other_cents" bigint DEFAULT 0 NOT NULL,
	"trust_cents" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "vendor_disbursements_vendor_id_contract_id_transaction_date_reference_unique" UNIQUE("vendor_id","contract_id","transaction_date","reference")
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_account_code" text NOT NULL,
	"display_name" text NOT NULL,
	"reference_line" text,
	"address_line1" text,
	"city_state_zip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendors_vendor_account_code_unique" UNIQUE("vendor_account_code")
);
--> statement-breakpoint
ALTER TABLE "vendor_disbursements" ADD CONSTRAINT "vendor_disbursements_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_disbursements" ADD CONSTRAINT "vendor_disbursements_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;