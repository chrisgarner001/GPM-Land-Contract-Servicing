ALTER TABLE "contract_parties" DROP CONSTRAINT "contract_parties_contract_id_party_id_role_unique";--> statement-breakpoint
ALTER TABLE "contract_parties" ADD COLUMN "funded_amount_cents" bigint;--> statement-breakpoint
ALTER TABLE "contract_parties" ADD COLUMN "interest_rate_annual" numeric(7, 4);--> statement-breakpoint
ALTER TABLE "contract_parties" ADD COLUMN "funding_date" date;--> statement-breakpoint
ALTER TABLE "contract_parties" ADD COLUMN "end_date" date;