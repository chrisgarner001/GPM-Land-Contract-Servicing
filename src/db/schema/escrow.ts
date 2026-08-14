import { pgTable, uuid, text, date, bigint, pgEnum, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { contracts } from "./contracts";

// Confirmed directly in TMO's live Trust Ledger UI (filter tabs "Reserve" /
// "Impound"), and by the business: Impound funds property tax + insurance
// escrow; Reserve holds prepayments/partial P&I payments not yet fully
// applied. Nullable because historical CSV-migrated entries can't always be
// classified after the fact — only entries we can confidently infer get one.
export const escrowCategoryEnum = pgEnum("escrow_category", ["RESERVE", "IMPOUND"]);

export const voucherTypeEnum = pgEnum("voucher_type", ["PROPERTY_TAX", "HOMEOWNERS_INSURANCE", "OTHER"]);

export const voucherFrequencyEnum = pgEnum("voucher_frequency", [
  "ONE_TIME",
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUALLY",
  "YEARLY",
]);

/**
 * Faithful mirror of TMO's "TRUST ACCOUNT ACTIVITY" table per contract — the
 * escrow/impound sub-ledger showing actual disbursements (tax authorities,
 * insurance companies) and credits into the impound account. category and
 * voucherType are left nullable and populated only when confidently known
 * (e.g. generated from an EscrowVoucher, or reclassified by hand) — CSV-only
 * migrated history often can't be classified after the fact.
 */
export const trustLedgerEntries = pgTable("trust_ledger_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contract_id").notNull().references(() => contracts.id),
  transactionDate: date("transaction_date").notNull(),
  reference: text("reference"),
  payeeOrPayerName: text("payee_or_payer_name"),
  description: text("description"),
  amountPaidOutCents: bigint("amount_paid_out_cents", { mode: "number" }),
  amountReceivedCents: bigint("amount_received_cents", { mode: "number" }),
  balanceCents: bigint("balance_cents", { mode: "number" }),
  category: escrowCategoryEnum("category"),
  voucherType: voucherTypeEnum("voucher_type"),
});

/**
 * Recurring escrow payment template — confirmed live in TMO under
 * Loan > Terms > Escrow Vouchers. This is the actual mechanism behind the
 * property-tax pain point this project started from: each tax/insurance
 * bill is configured once (payee, amount, frequency, property) and TMO
 * auto-generates the disbursement (a TrustLedgerEntry) on the pay date,
 * rather than someone re-entering it every cycle.
 */
export const escrowVouchers = pgTable("escrow_vouchers", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contract_id").notNull().references(() => contracts.id),
  payeeName: text("payee_name").notNull(),
  payeeReference: text("payee_reference"),
  description: text("description"),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  frequency: voucherFrequencyEnum("frequency").notNull().default("YEARLY"),
  voucherType: voucherTypeEnum("voucher_type"),
  nextPayDate: date("next_pay_date").notNull(),
  onHold: boolean("on_hold").notNull().default(false),
  discretionary: boolean("discretionary").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const escrowAnalysisTriggerEnum = pgEnum("escrow_analysis_trigger", [
  "SEMI_ANNUAL_SCHEDULED",
  "LARGE_BILL_RECEIVED",
  "ONBOARDING",
  "MANUAL",
]);

export const escrowAnalysisStatusEnum = pgEnum("escrow_analysis_status", ["DRAFT", "FINALIZED", "SENT"]);

/**
 * Confirmed business methodology (regulatory-significant — this is one of
 * the most heavily scrutinized areas for servicers): run twice a year, or ad
 * hoc when an unusually large tax bill is received. Projects the next 12
 * months of tax + insurance disbursements and compares against current
 * escrow collections, targeting a 5% buffer (this business's own policy —
 * land contracts aren't subject to RESPA's 1/6-cushion rule). The same
 * methodology sets the initial impound payment at onboarding (trigger =
 * ONBOARDING). See domain/escrow/runEscrowAnalysis.ts for the calculation.
 */
export const escrowAnalyses = pgTable("escrow_analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contract_id").notNull().references(() => contracts.id),
  analysisDate: date("analysis_date").notNull(),
  effectiveDate: date("effective_date").notNull(),
  trigger: escrowAnalysisTriggerEnum("trigger").notNull(),
  projectionPeriodMonths: numeric("projection_period_months", { precision: 3, scale: 0 }).notNull().default("12"),
  // Superseded by cushionMonths (confirmed business decision — a flat
  // months-of-payment cushion replaces the percent-of-annual-disbursement
  // one) — kept, unused, only so historical rows stay readable.
  cushionPercent: numeric("cushion_percent", { precision: 5, scale: 2 }).notNull().default("5.00"),
  cushionMonths: numeric("cushion_months", { precision: 4, scale: 1 }),
  projectedAnnualTaxCents: bigint("projected_annual_tax_cents", { mode: "number" }).notNull(),
  projectedAnnualInsuranceCents: bigint("projected_annual_insurance_cents", { mode: "number" }).notNull(),
  cushionTargetCents: bigint("cushion_target_cents", { mode: "number" }).notNull(),
  currentEscrowBalanceCents: bigint("current_escrow_balance_cents", { mode: "number" }).notNull(),
  currentMonthlyEscrowPaymentCents: bigint("current_monthly_escrow_payment_cents", { mode: "number" }).notNull(),
  projectedEndingBalanceCents: bigint("projected_ending_balance_cents", { mode: "number" }).notNull(),
  shortageOrSurplusCents: bigint("shortage_or_surplus_cents", { mode: "number" }).notNull(),
  newMonthlyEscrowPaymentCents: bigint("new_monthly_escrow_payment_cents", { mode: "number" }).notNull(),
  status: escrowAnalysisStatusEnum("status").notNull().default("DRAFT"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
