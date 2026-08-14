ALTER TYPE "public"."payment_method" ADD VALUE 'PAID_ONLINE' BEFORE 'ADJUSTMENT';--> statement-breakpoint
ALTER TABLE "vendor_disbursements" ADD COLUMN "payment_method" "payment_method";