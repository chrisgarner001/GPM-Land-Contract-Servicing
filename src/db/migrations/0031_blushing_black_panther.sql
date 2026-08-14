CREATE TYPE "public"."posted_document_type" AS ENUM('STATEMENT_OF_ACCOUNT', 'OUTSTANDING_CHARGES');--> statement-breakpoint
CREATE TABLE "posted_borrower_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"document_type" "posted_document_type" NOT NULL,
	"range_start" date NOT NULL,
	"range_end" date NOT NULL,
	"content_html" text NOT NULL,
	"posted_by" text,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posted_borrower_documents" ADD CONSTRAINT "posted_borrower_documents_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;