import { pgTable, uuid, text, bigint, date, timestamp } from "drizzle-orm/pg-core";
import { contracts } from "./contracts";
import { bankAccounts } from "./setup";
import { paymentMethodEnum } from "./payments";
import { checks } from "./checks";

// A third party SGMS pays out of escrow/trust on a borrower's behalf — tax
// authorities, insurance carriers, title companies, attorneys. Confirmed
// against the "Vendor Statement of Account" TMO export: each vendor has a
// short account code (e.g. "AAA", "FREEONTINS") that's the true unique
// identity, distinct from its display name.
export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorAccountCode: text("vendor_account_code").notNull().unique(),
    displayName: text("display_name").notNull(),
    referenceLine: text("reference_line"),
    addressLine1: text("address_line1"),
    cityStateZip: text("city_state_zip"),
    // Not part of the original TMO import (vendors never had one) — added for
    // the Notices Template Builder's Email channel, since a vendor needs a
    // real inbox to send a generated notice to.
    email: text("email"),
    // Which of the business's own bank accounts (Setup > Bank Accounts) this
    // vendor is normally paid from — e.g. a tax authority defaults to Escrow.
    defaultBankAccountId: uuid("default_bank_account_id").references(() => bankAccounts.id),
    // Pre-selected (but still editable) on New Invoice once this vendor is
    // chosen, since most vendors always post to the same GL code.
    defaultGlCode: text("default_gl_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

// One row per "ACCOUNT ACTIVITY" line in a vendor's statement — a
// disbursement paid to this vendor on behalf of a specific contract.
//
// No unique constraint on (vendor, contract, date, reference): confirmed
// against real data that a single check can carry multiple genuinely
// distinct line items for the same loan account on the same date (partial
// charges, corrections/reversals) that share all four of those fields — an
// earlier version of this table had such a constraint and it silently
// dropped ~2,935 real transactions via onConflictDoNothing before the bug
// was caught and the data was re-imported.
export const vendorDisbursements = pgTable("vendor_disbursements", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id").notNull().references(() => vendors.id),
  contractId: uuid("contract_id").notNull().references(() => contracts.id),
  transactionDate: date("transaction_date").notNull(),
  reference: text("reference"),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  // Staff-entered classification for manually-keyed invoices (New Invoice
  // form) — free text since the real chart of accounts hasn't been modeled
  // yet. Null for TMO-imported historical rows, which never carried this.
  glCode: text("gl_code"),
  // How the vendor was paid — staff-entered on the New Invoice form. Null for
  // TMO-imported historical rows, which never carried this.
  paymentMethod: paymentMethodEnum("payment_method"),
  // Set once this disbursement has been included on a printed check (see
  // /vendors/print-checks) — only ever set when paymentMethod = 'CHECK'.
  // Null means either not paid by check, or paid by check but not yet run
  // through Print Checks.
  checkId: uuid("check_id").references(() => checks.id),
  servicingFeeCents: bigint("servicing_fee_cents", { mode: "number" }).notNull().default(0),
  interestDistributionCents: bigint("interest_distribution_cents", { mode: "number" }).notNull().default(0),
  principalDistributionCents: bigint("principal_distribution_cents", { mode: "number" }).notNull().default(0),
  chargesCents: bigint("charges_cents", { mode: "number" }).notNull().default(0),
  otherCents: bigint("other_cents", { mode: "number" }).notNull().default(0),
  trustCents: bigint("trust_cents", { mode: "number" }).notNull().default(0),
});
