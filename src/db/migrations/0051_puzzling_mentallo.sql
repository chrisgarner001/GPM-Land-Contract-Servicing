CREATE TYPE "public"."land_contract_package_status" AS ENUM('DRAFT', 'PUBLISHED');--> statement-breakpoint
CREATE TABLE "land_contract_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "land_contract_package_status" DEFAULT 'DRAFT' NOT NULL,
	"buyer_name" text,
	"property_address" text,
	"closing_date" text,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"drive_folder_url" text,
	"published_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
