-- Hand-written instead of drizzle-kit's generated drop/recreate (which would
-- have tried to cast existing 'STAFF' rows straight into a new enum that no
-- longer has that value, and failed). RENAME VALUE preserves every existing
-- row's meaning automatically — a STAFF user has always had exactly the
-- access OFFICE now means, just under a clearer name now that a third tier
-- (USER, view-only) exists.
ALTER TYPE "public"."staff_role" RENAME VALUE 'STAFF' TO 'OFFICE';--> statement-breakpoint
ALTER TYPE "public"."staff_role" ADD VALUE 'USER';--> statement-breakpoint
ALTER TABLE "staff_users" ALTER COLUMN "role" SET DEFAULT 'OFFICE';
