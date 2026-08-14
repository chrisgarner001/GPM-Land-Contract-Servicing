CREATE TABLE "check_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"check_id" uuid NOT NULL,
	"contract_id" uuid,
	"loan_account_raw" text,
	"amount_cents" bigint NOT NULL,
	"servicing_fee_cents" bigint DEFAULT 0 NOT NULL,
	"interest_cents" bigint DEFAULT 0 NOT NULL,
	"principal_cents" bigint DEFAULT 0 NOT NULL,
	"late_charges_cents" bigint DEFAULT 0 NOT NULL,
	"charges_amount_cents" bigint DEFAULT 0 NOT NULL,
	"charges_interest_cents" bigint DEFAULT 0 NOT NULL,
	"other_payments_cents" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"check_number" text NOT NULL,
	"check_date" date NOT NULL,
	"payee_code" text NOT NULL,
	"payee_name" text NOT NULL,
	"total_amount_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "check_line_items" ADD CONSTRAINT "check_line_items_check_id_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."checks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_line_items" ADD CONSTRAINT "check_line_items_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "check_line_items_contract_id_idx" ON "check_line_items" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "checks_check_date_idx" ON "checks" USING btree ("check_date");