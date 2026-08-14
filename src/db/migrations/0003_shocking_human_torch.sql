CREATE TABLE "lender_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lender_party_id" uuid NOT NULL,
	"source_contract_id" uuid,
	"transaction_date" date NOT NULL,
	"reference" text,
	"description" text,
	"amount_paid_out_cents" bigint,
	"amount_received_cents" bigint,
	"balance_cents" bigint
);
--> statement-breakpoint
ALTER TABLE "contract_parties" ADD COLUMN "broker_servicing_fee_cents" bigint;--> statement-breakpoint
ALTER TABLE "lender_ledger_entries" ADD CONSTRAINT "lender_ledger_entries_lender_party_id_parties_id_fk" FOREIGN KEY ("lender_party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_ledger_entries" ADD CONSTRAINT "lender_ledger_entries_source_contract_id_contracts_id_fk" FOREIGN KEY ("source_contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;