ALTER TABLE "properties" ADD COLUMN "insurance_carrier_vendor_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "release_date" date;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "release_override" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "escrow_analyses" ADD COLUMN "cushion_months" numeric(4, 1);--> statement-breakpoint
ALTER TABLE "party_email_drafts" ADD COLUMN "bcc_address" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "default_gl_code" text;--> statement-breakpoint
ALTER TABLE "notice_templates" ADD COLUMN "min_days_past_due" integer;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_insurance_carrier_vendor_id_vendors_id_fk" FOREIGN KEY ("insurance_carrier_vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;