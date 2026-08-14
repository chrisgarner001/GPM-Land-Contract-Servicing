CREATE TYPE "public"."preferred_payment_method" AS ENUM('CHECK', 'ACH');--> statement-breakpoint
CREATE TYPE "public"."lender_ledger_entry_type" AS ENUM('PAYMENT_CREDIT', 'CHARGE_CREDIT', 'CHARGE_DEBIT', 'DISTRIBUTION');--> statement-breakpoint
CREATE TYPE "public"."check_payment_method" AS ENUM('CHECK', 'ACH');--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "preferred_payment_method" "preferred_payment_method";--> statement-breakpoint
ALTER TABLE "lender_ledger_entries" ADD COLUMN "entry_type" "lender_ledger_entry_type";--> statement-breakpoint
ALTER TABLE "lender_ledger_entries" ADD COLUMN "source_payment_id" uuid;--> statement-breakpoint
ALTER TABLE "lender_ledger_entries" ADD COLUMN "interest_cents" bigint;--> statement-breakpoint
ALTER TABLE "lender_ledger_entries" ADD COLUMN "principal_cents" bigint;--> statement-breakpoint
ALTER TABLE "lender_ledger_entries" ADD COLUMN "servicing_fee_cents" bigint;--> statement-breakpoint
ALTER TABLE "checks" ADD COLUMN "payment_method" "check_payment_method" DEFAULT 'CHECK' NOT NULL;--> statement-breakpoint
ALTER TABLE "lender_ledger_entries" ADD CONSTRAINT "lender_ledger_entries_source_payment_id_payments_id_fk" FOREIGN KEY ("source_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Backfill entry_type on existing rows from the columns that already imply
-- it (no free-text guessing): sourceContractId IS NULL is exactly how an
-- outbound "Lender Check" sweep row has always been recorded (see the
-- lender_ledger_entries schema comment), so it's DISTRIBUTION; a row with a
-- source contract and an amount received is a credit; one with a source
-- contract and an amount paid out is a charge debit.
UPDATE "lender_ledger_entries" SET "entry_type" = 'DISTRIBUTION' WHERE "source_contract_id" IS NULL;--> statement-breakpoint
UPDATE "lender_ledger_entries" SET "entry_type" = 'PAYMENT_CREDIT' WHERE "source_contract_id" IS NOT NULL AND "amount_received_cents" IS NOT NULL;--> statement-breakpoint
UPDATE "lender_ledger_entries" SET "entry_type" = 'CHARGE_DEBIT' WHERE "source_contract_id" IS NOT NULL AND "amount_paid_out_cents" IS NOT NULL;--> statement-breakpoint
-- Separately discovered while building Lender Payment Runs: balance_cents
-- was NULL on every historical row (the import never populated a running
-- balance at all) — this silently zeroed out getLatestLenderBalanceCents()
-- for every lender (affecting the pre-existing Charge Lender flow and the
-- lender portal's Balance column, not just this feature). Backfills the
-- correct running cumulative balance, ordered the same way every other
-- "latest row" read in this codebase already tiebreaks (transaction_date,
-- then id).
WITH running AS (
  SELECT id,
    SUM(COALESCE("amount_received_cents", 0) - COALESCE("amount_paid_out_cents", 0))
      OVER (PARTITION BY "lender_party_id" ORDER BY "transaction_date", "id" ROWS UNBOUNDED PRECEDING) AS running_balance
  FROM "lender_ledger_entries"
)
UPDATE "lender_ledger_entries" l SET "balance_cents" = r.running_balance FROM running r WHERE l.id = r.id;