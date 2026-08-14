CREATE TYPE "public"."outgoing_email_status" AS ENUM('PENDING', 'DRAFTED');--> statement-breakpoint
CREATE TABLE "party_email_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" uuid NOT NULL,
	"to_address" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" "outgoing_email_status" DEFAULT 'PENDING' NOT NULL,
	"gmail_draft_id" text,
	"author_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"drafted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "party_email_drafts" ADD CONSTRAINT "party_email_drafts_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;