CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"bank_name" text,
	"routing_number" text,
	"account_number_last4" text,
	"account_number_encrypted" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
