CREATE TYPE "public"."document_type" AS ENUM('QCD', 'WD', 'WDS', 'LC', 'QCDLC');--> statement-breakpoint
CREATE TABLE "generated_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid,
	"doc_type" "document_type" NOT NULL,
	"grantor_name" text,
	"grantee_name" text,
	"property_address" text,
	"data_snapshot" text NOT NULL,
	"generated_by" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;