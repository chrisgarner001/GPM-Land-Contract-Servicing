import { pgTable, uuid, text, timestamp, pgEnum, bigint, numeric, integer, boolean, date } from "drizzle-orm/pg-core";
import { parties, properties } from "./parties";

export const contractStatusEnum = pgEnum("contract_status", [
  "ACTIVE",
  "PAID_OFF",
  "DEFAULTED",
  "CANCELLED",
  "IN_FORECLOSURE",
]);

export const interestMethodEnum = pgEnum("interest_method", ["SIMPLE_30_360", "SIMPLE_ACTUAL_365"]);

export const paymentFrequencyEnum = pgEnum("payment_frequency", ["MONTHLY", "SEMI_MONTHLY", "BIWEEKLY"]);

export const contractPartyRoleEnum = pgEnum("contract_party_role", [
  "BUYER",
  "CO_BUYER",
  "SELLER",
  "CO_SELLER",
  "INVESTOR_PAYEE",
]);

// ~95% of the book is LAND_CONTRACT; FIRST_LIEN/SECOND_LIEN/UNSECURED cover
// the rest. Defaults to LAND_CONTRACT on the existing portfolio — staff
// reclassify the handful of non-LC contracts manually after migration.
export const loanTypeEnum = pgEnum("loan_type", [
  "LAND_CONTRACT",
  "FIRST_LIEN",
  "SECOND_LIEN",
  "UNSECURED",
]);

export const lienPriorityEnum = pgEnum("lien_priority", [
  "1ST",
  "2ND",
  "3RD",
  "4TH",
  "5TH",
  "6TH",
  "7TH",
  "8TH",
  "OTHER",
]);

// Confirmed against live TMO data: some loan types charge a flat dollar late
// fee, others a percentage of either just P&I or the full total payment
// (P&I + escrow). Land contracts in the initial migration are all FLAT, but
// the field needs to support the other two for parity with the source system.
export const lateFeeTypeEnum = pgEnum("late_fee_type", ["FLAT", "PERCENT_OF_PI", "PERCENT_OF_TOTAL_PAYMENT"]);

// Staff-selected stage of the forfeiture/foreclosure process — a coarse
// manual flag alongside the specific Court Status dates, since not every
// stage has its own date field (e.g. "in court" generally, before any
// hearing is scheduled).
export const legalProcessStageEnum = pgEnum("legal_process_stage", ["COURT", "FORECLOSED", "FORFEITED"]);

export const contracts = pgTable("contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractNumber: text("contract_number").notNull().unique(),
  propertyId: uuid("property_id").notNull().references(() => properties.id),

  purchasePriceCents: bigint("purchase_price_cents", { mode: "number" }).notNull(),
  downPaymentCents: bigint("down_payment_cents", { mode: "number" }).notNull(),
  originalPrincipalCents: bigint("original_principal_cents", { mode: "number" }).notNull(),
  // Cached for fast reads — never authoritative. Always derivable/reconciled
  // from the sum of payment_allocations; only ever updated inside the same
  // transaction as a ledger insert.
  currentPrincipalBalanceCents: bigint("current_principal_balance_cents", { mode: "number" }).notNull(),

  interestRateAnnual: numeric("interest_rate_annual", { precision: 7, scale: 4 }).notNull(),
  // Governs REGULAR scheduled-payment interest only. Confirmed against real
  // TMO data that payoff/per-diem interest always uses actual/365 regardless
  // of this setting — see domain/amortization/calculatePayoffQuote.ts.
  interestMethod: interestMethodEnum("interest_method").notNull().default("SIMPLE_30_360"),

  loanType: loanTypeEnum("loan_type").notNull().default("LAND_CONTRACT"),
  lienPriority: lienPriorityEnum("lien_priority").notNull().default("1ST"),

  amortizationTermMonths: integer("amortization_term_months").notNull(),
  paymentAmountCents: bigint("payment_amount_cents", { mode: "number" }).notNull(),
  paymentFrequency: paymentFrequencyEnum("payment_frequency").notNull().default("MONTHLY"),

  originationDate: date("origination_date").notNull(),
  firstPaymentDate: date("first_payment_date").notNull(),
  maturityDate: date("maturity_date"),
  // TMO's own "Next Payment Date" field from the LOAN TERMS section — the
  // authoritative next-due date, not derived/computed from the schedule.
  nextPaymentDate: date("next_payment_date"),
  // The actual historical date the contract was paid in full — distinct from
  // statusChangedAt, which only records when OUR system observed the status
  // change (e.g. at migration import time), not the real-world payoff date.
  paidOffDate: date("paid_off_date"),
  hasBalloon: boolean("has_balloon").notNull().default(false),
  balloonAmountCents: bigint("balloon_amount_cents", { mode: "number" }),
  balloonDueDate: date("balloon_due_date"),

  lateFeeType: lateFeeTypeEnum("late_fee_type").notNull().default("FLAT"),
  // Used when lateFeeType is FLAT.
  lateFeeAmountCents: bigint("late_fee_amount_cents", { mode: "number" }),
  // Used when lateFeeType is PERCENT_OF_PI or PERCENT_OF_TOTAL_PAYMENT, e.g. 5.00 for 5%.
  lateFeePercent: numeric("late_fee_percent", { precision: 5, scale: 2 }),
  lateFeeGraceDays: integer("late_fee_grace_days"),

  escrowRequired: boolean("escrow_required").notNull().default(false),

  status: contractStatusEnum("status").notNull().default("ACTIVE"),
  statusChangedAt: timestamp("status_changed_at", { withTimezone: true }),

  // Land contract forfeiture/eviction process tracking — staff-entered, no
  // import source. All nullable/optional since most contracts never enter
  // this process.
  forfeitureNoticeSentDate: date("forfeiture_notice_sent_date"),
  courtHearingDate: date("court_hearing_date"),
  judgmentReceivedDate: date("judgment_received_date"),
  evictionDate: date("eviction_date"),
  legalProcessStage: legalProcessStageEnum("legal_process_stage"),
  // Hard compliance flag, independent of legalProcessStage — an automatic
  // bankruptcy stay blocks ALL creditor communication (not just late
  // notices), regardless of whatever legal/foreclosure stage the contract
  // is otherwise in. Checked before every outgoing notice/email.
  inBankruptcy: boolean("in_bankruptcy").notNull().default(false),

  // Shareable link to this contract's Google Drive folder (staff-entered —
  // no Drive API integration, just a stored URL to the folder).
  googleDriveFolderUrl: text("google_drive_folder_url"),

  // Borrower online-portal access — confirmed live in TMO's own borrower
  // portal export, keyed by loan account (not by party), since co-buyers
  // share one portal login per account.
  borrowerPortalPin: text("borrower_portal_pin"),
  borrowerPortalEmail: text("borrower_portal_email"),
  // Set only by a genuine self-service borrower login — none exists yet
  // (only staff Log In As impersonation), so this stays null until that's
  // built. Present now so the Online Portal box has somewhere to read it
  // from once it exists.
  borrowerPortalLastLoginAt: timestamp("borrower_portal_last_login_at", { withTimezone: true }),
  // Actually enforced: blocks staff's Log In As impersonation (the only
  // login path today) until reactivated.
  borrowerPortalDeactivated: boolean("borrower_portal_deactivated").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contractParties = pgTable("contract_parties", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contract_id").notNull().references(() => contracts.id),
  partyId: uuid("party_id").notNull().references(() => parties.id),
  role: contractPartyRoleEnum("role").notNull(),
  ownershipPercent: numeric("ownership_percent", { precision: 5, scale: 2 }),
  // INVESTOR_PAYEE only. Confirmed live: this business always uses a flat
  // dollar broker servicing fee (never a % or a note/lender-rate spread) —
  // deducted from this lender's share of each payment before crediting
  // their ledger. See domain/lending/calculateLenderShare.ts.
  brokerServicingFeeCents: bigint("broker_servicing_fee_cents", { mode: "number" }),
  // INVESTOR_PAYEE only — the Funding history feature. Each row is one
  // funding period: fundingDate/endDate bound when this party was (or is)
  // the active lender, so "current" is endDate IS NULL AND ownershipPercent
  // > 0 (the same filter every other page already uses to find the active
  // lender). No unique constraint on (contractId, partyId, role) deliberately
  // — a lender can fund the same contract again in a later period after
  // being superseded, which would otherwise collide with its own closed-out
  // historical row.
  fundedAmountCents: bigint("funded_amount_cents", { mode: "number" }),
  interestRateAnnual: numeric("interest_rate_annual", { precision: 7, scale: 4 }),
  fundingDate: date("funding_date"),
  endDate: date("end_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
