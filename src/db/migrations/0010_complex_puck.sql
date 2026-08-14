ALTER TABLE "vendor_disbursements" DROP CONSTRAINT "vendor_disbursements_vendor_id_contract_id_transaction_date_reference_unique";--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "forfeiture_notice_sent_date" date;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "court_hearing_date" date;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "judgment_received_date" date;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "eviction_date" date;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "google_drive_folder_url" text;