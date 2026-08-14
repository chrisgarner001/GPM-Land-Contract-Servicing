CREATE TYPE "public"."customization_status" AS ENUM('DRAFTING', 'SUBMITTED');--> statement-breakpoint
CREATE TYPE "public"."customization_task_type" AS ENUM('NEW_FEATURE', 'ENHANCEMENT', 'IMPROVEMENT', 'BUG_FIX');--> statement-breakpoint
CREATE TABLE "customization_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"task_type" "customization_task_type" NOT NULL,
	"status" "customization_status" DEFAULT 'DRAFTING' NOT NULL,
	"conversation" text NOT NULL,
	"product_brief_markdown" text,
	"engineering_brief_markdown" text,
	"requested_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
