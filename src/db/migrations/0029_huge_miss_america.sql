CREATE TYPE "public"."notice_category" AS ENUM('BORROWER', 'LENDER', 'VENDOR');--> statement-breakpoint
CREATE TYPE "public"."notice_channel" AS ENUM('EMAIL', 'LETTER');--> statement-breakpoint
CREATE TYPE "public"."notice_send_status" AS ENUM('SENT', 'FAILED');--> statement-breakpoint
CREATE TABLE "notice_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"category" "notice_category" NOT NULL,
	"recipient_id" uuid NOT NULL,
	"contract_id" uuid,
	"channel" "notice_channel" NOT NULL,
	"subject_rendered" text,
	"body_rendered" text NOT NULL,
	"status" "notice_send_status" NOT NULL,
	"provider_message_id" text,
	"error_message" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notice_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "notice_category" NOT NULL,
	"channel" "notice_channel" NOT NULL,
	"name" text NOT NULL,
	"subject" text,
	"body_template" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "notice_sends" ADD CONSTRAINT "notice_sends_template_id_notice_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."notice_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_sends" ADD CONSTRAINT "notice_sends_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;