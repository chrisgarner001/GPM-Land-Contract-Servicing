CREATE TYPE "public"."posted_lender_document_type" AS ENUM('ACCRUED_INTEREST', 'PRINCIPAL_CHANGE', 'PORTFOLIO_CHARGES');--> statement-breakpoint
CREATE TABLE "posted_lender_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lender_party_id" uuid NOT NULL,
	"document_type" "posted_lender_document_type" NOT NULL,
	"range_start" date NOT NULL,
	"range_end" date NOT NULL,
	"content_html" text NOT NULL,
	"posted_by" text,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posted_lender_documents" ADD CONSTRAINT "posted_lender_documents_lender_party_id_parties_id_fk" FOREIGN KEY ("lender_party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;