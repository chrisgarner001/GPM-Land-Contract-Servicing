CREATE TYPE "public"."contract_onboarding_draft_status" AS ENUM('DRAFT', 'PUBLISHED');--> statement-breakpoint
CREATE TABLE "contract_onboarding_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "contract_onboarding_draft_status" DEFAULT 'DRAFT' NOT NULL,
	"borrower_name" text,
	"property_address" text,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_contract_id" uuid,
	"published_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contract_onboarding_drafts" ADD CONSTRAINT "contract_onboarding_drafts_published_contract_id_contracts_id_fk" FOREIGN KEY ("published_contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;