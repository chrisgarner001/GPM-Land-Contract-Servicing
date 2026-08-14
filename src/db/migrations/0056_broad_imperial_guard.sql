ALTER TABLE "parties" ADD COLUMN "deactivated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "deactivated" boolean DEFAULT false NOT NULL;