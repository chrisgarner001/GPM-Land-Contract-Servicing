ALTER TABLE "parties" ADD COLUMN "tax_id_encrypted" text;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "ach_bank_name" text;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "ach_routing_number" text;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "ach_account_last4" text;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "ach_account_number_encrypted" text;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "google_drive_folder_url" text;