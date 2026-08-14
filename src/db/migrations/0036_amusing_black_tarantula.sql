ALTER TABLE "vendor_disbursements" ADD COLUMN "check_id" uuid;--> statement-breakpoint
ALTER TABLE "checks" ADD COLUMN "printed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendor_disbursements" ADD CONSTRAINT "vendor_disbursements_check_id_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."checks"("id") ON DELETE no action ON UPDATE no action;