CREATE TYPE "public"."property_type" AS ENUM('SINGLE_FAMILY', 'MULTI_FAMILY', 'COMMERCIAL', 'OTHER');--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "property_type" "property_type";