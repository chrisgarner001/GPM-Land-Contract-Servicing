CREATE TABLE "company_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text DEFAULT '' NOT NULL,
	"company_address_line1" text DEFAULT '' NOT NULL,
	"company_city" text DEFAULT '' NOT NULL,
	"company_state" text DEFAULT '' NOT NULL,
	"company_zip" text DEFAULT '' NOT NULL,
	"company_nmls_id" text,
	"preparer_firm_name" text DEFAULT '' NOT NULL,
	"preparer_attorney_name" text DEFAULT '' NOT NULL,
	"preparer_address_line1" text DEFAULT '' NOT NULL,
	"preparer_city" text DEFAULT '' NOT NULL,
	"preparer_state" text DEFAULT '' NOT NULL,
	"preparer_zip" text DEFAULT '' NOT NULL,
	"title_fee_cents" bigint,
	"default_contact_name" text DEFAULT '' NOT NULL,
	"default_contact_address_line1" text DEFAULT '' NOT NULL,
	"default_contact_city" text DEFAULT '' NOT NULL,
	"default_contact_state" text DEFAULT '' NOT NULL,
	"default_contact_zip" text DEFAULT '' NOT NULL,
	"default_notary_state" text DEFAULT 'Michigan' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Blank row (not SGMS's real values — this is a different company's
-- deployment) so the app has exactly one company_settings row to read
-- from day one. Fill in real values via Setup > Company Settings.
INSERT INTO "company_settings" DEFAULT VALUES;
