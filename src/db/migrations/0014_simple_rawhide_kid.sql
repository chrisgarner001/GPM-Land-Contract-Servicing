CREATE TYPE "public"."legal_process_stage" AS ENUM('COURT', 'FORECLOSED', 'FORFEITED');--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "legal_process_stage" "legal_process_stage";