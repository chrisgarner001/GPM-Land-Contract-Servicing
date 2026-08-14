ALTER TABLE "parties" ADD COLUMN "portal_last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "portal_deactivated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "borrower_portal_last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "borrower_portal_deactivated" boolean DEFAULT false NOT NULL;