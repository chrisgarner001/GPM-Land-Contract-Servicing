ALTER TABLE "properties" ALTER COLUMN "property_type" SET DEFAULT 'SINGLE_FAMILY';--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "insurance_carrier" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "insurance_last_bill_amount_cents" bigint;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "insurance_last_bill_date" date;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "winter_tax_last_bill_amount_cents" bigint;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "winter_tax_last_bill_date" date;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "summer_tax_last_bill_amount_cents" bigint;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "summer_tax_last_bill_date" date;