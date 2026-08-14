CREATE TYPE "public"."email_format" AS ENUM('HTML', 'TEXT');--> statement-breakpoint
CREATE TYPE "public"."tin_type" AS ENUM('SSN', 'EIN');--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "mailing_country" text;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "salutation" text;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "middle_initial" text;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "phone_home" text;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "phone_work" text;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "phone_mobile" text;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "phone_fax" text;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "email_format" "email_format";--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "delivery_by_print" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "delivery_by_email" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "delivery_by_sms" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "legal_structure" text;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "tin_type" "tin_type";--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "on_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "alternate_tax_info" text;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "send_tax_reporting" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "send_late_notices" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "send_payment_receipts" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "send_payment_statements" boolean DEFAULT false NOT NULL;