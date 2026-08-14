import { pgTable, uuid, text, pgEnum, timestamp, bigint } from "drizzle-orm/pg-core";

export const staffRoleEnum = pgEnum("staff_role", ["ADMIN", "STAFF"]);

// Reference list only — informational (who's on the team, their role, how
// to reach them). Does not control real login access; that's managed
// directly in the Supabase dashboard, same as today.
export const staffUsers = pgTable("staff_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: staffRoleEnum("role").notNull().default("STAFF"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// CURRENT_ASSET/CURRENT_LIABILITY kept for backward compatibility (Postgres
// enums can't drop values) but no longer offered in the UI as of the real
// QuickBooks chart-of-accounts import — replaced by the more granular types
// QB itself uses (OTHER_CURRENT_ASSET, FIXED_ASSET, etc.), so a code's type
// actually matches its QB account type instead of a lossy 6-bucket guess.
export const glCodeTypeEnum = pgEnum("gl_code_type", [
  "INCOME",
  "EXPENSE",
  "BANK",
  "CURRENT_ASSET",
  "CURRENT_LIABILITY",
  "EQUITY",
  "OTHER_CURRENT_ASSET",
  "FIXED_ASSET",
  "OTHER_ASSET",
  "CREDIT_CARD",
  "OTHER_CURRENT_LIABILITY",
  "LONG_TERM_LIABILITY",
  "COST_OF_GOODS_SOLD",
  "OTHER_INCOME",
  "OTHER_EXPENSE",
]);

// System-wide GL code list — feeds the select on the Vendors > New Invoice
// form so invoices are classified consistently instead of free text.
export const glCodes = pgTable("gl_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  description: text("description"),
  type: glCodeTypeEnum("type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// The business's own bank accounts (operating, trust, escrow, etc.) — a
// reference list for staff, not a payment-processing integration. Full
// account number is AES-256-GCM encrypted (see lib/encryption.ts), matching
// the same treatment used for lender/borrower ACH banking info; the routing
// number is a public bank identifier and stays plaintext.
export const bankAccounts = pgTable("bank_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
  bankName: text("bank_name"),
  routingNumber: text("routing_number"),
  accountNumberLast4: text("account_number_last4"),
  accountNumberEncrypted: text("account_number_encrypted"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Single-row table (exactly one deployment's own business identity) — the
// values baked into Success Group Mortgage and Servicing's deed and land
// contract package documents (company/lender identity, document preparer,
// title fee, default drafter contact) as configuration instead of hardcoded
// literals, so a white-labeled deployment for a different servicing company
// only needs different data here, not code/template edits. Deliberately
// does NOT cover the Michigan-specific legal boilerplate baked into the
// document templates themselves (statute references, "STATE OF MICHIGAN"
// jurats, the MI transfer-tax formula) — that's real legal drafting for
// whatever state a given deployment operates in, not something a settings
// table can genericize.
export const companySettings = pgTable("company_settings", {
  id: uuid("id").primaryKey().defaultRandom(),

  // This deployment's own servicing/lending entity — appears as the
  // "Lender" on land contract packages, e.g. "Success Group Mortgage and
  // Servicing, LLC".
  companyName: text("company_name").notNull().default(""),
  companyAddressLine1: text("company_address_line1").notNull().default(""),
  companyCity: text("company_city").notNull().default(""),
  companyState: text("company_state").notNull().default(""),
  companyZip: text("company_zip").notNull().default(""),
  companyNmlsId: text("company_nmls_id"),

  // Document preparer/attorney — the "This instrument was prepared by:"
  // block on deeds and land contract packages.
  preparerFirmName: text("preparer_firm_name").notNull().default(""),
  preparerAttorneyName: text("preparer_attorney_name").notNull().default(""),
  preparerAddressLine1: text("preparer_address_line1").notNull().default(""),
  preparerCity: text("preparer_city").notNull().default(""),
  preparerState: text("preparer_state").notNull().default(""),
  preparerZip: text("preparer_zip").notNull().default(""),
  titleFeeCents: bigint("title_fee_cents", { mode: "number" }),

  // Default drafter/return/tax-bill contact for one-off deed generation
  // (Document Dashboard) when no other value has been entered.
  defaultContactName: text("default_contact_name").notNull().default(""),
  defaultContactAddressLine1: text("default_contact_address_line1").notNull().default(""),
  defaultContactCity: text("default_contact_city").notNull().default(""),
  defaultContactState: text("default_contact_state").notNull().default(""),
  defaultContactZip: text("default_contact_zip").notNull().default(""),

  defaultNotaryState: text("default_notary_state").notNull().default("Michigan"),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
