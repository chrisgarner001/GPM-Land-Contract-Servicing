import { pgTable, uuid, text, bigint, date, timestamp, index, pgEnum } from "drizzle-orm/pg-core";
import { contracts } from "./contracts";
import { bankAccounts } from "./setup";

export const checkPaymentMethodEnum = pgEnum("check_payment_method", ["CHECK", "ACH"]);

// One row per check written by SGMS — payees span vendors, lenders, and
// SGMS/broker itself (confirmed against the real "Check Register with
// Detail" export: 200 distinct payee codes mixing vendor-style codes,
// lender codes like GLOBALPM, and internal codes like BROKER/SGMS). Payee is
// kept as plain text rather than FK'd to the vendors table — that table only
// covers third-party vendors, and forcing lender/internal payees into it
// would misrepresent them. Check numbers are NOT unique on their own (TMO
// resets numbering across payee/date sequences), so no unique constraint.
export const checks = pgTable(
  "checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    checkNumber: text("check_number").notNull(),
    checkDate: date("check_date").notNull(),
    payeeCode: text("payee_code").notNull(),
    payeeName: text("payee_name").notNull(),
    totalAmountCents: bigint("total_amount_cents", { mode: "number" }).notNull(),
    // Defaults to CHECK so every historical (imported) row is correctly
    // classified with no backfill needed — ACH distributions are new as of
    // Lender Payment Runs.
    paymentMethod: checkPaymentMethodEnum("payment_method").notNull().default("CHECK"),
    // Which of the business's own bank accounts this was paid from. The
    // TMO import never carried this, so historical checks are backfilled
    // only where reconstructable (lender distributions always cleared
    // Owner Trust — see scripts/backfill-check-bank-accounts.ts) and left
    // null ("Unclassified") otherwise — no signal exists to guess Escrow vs
    // Operating for the rest. New checks (Lender Payment Runs) set this.
    bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id),
    // Null for every historical (imported) check — set the first time this
    // app renders the check as a printable PDF, so the Print Checks queues
    // (lender and vendor) know what's still pending vs already run through
    // the printer.
    printedAt: timestamp("printed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("checks_check_date_idx").on(table.checkDate)]
);

// One row per detail line under a check. loanAccountRaw is always kept
// verbatim (a handful of real rows carry a borrower surname like "GOODALL"
// instead of a numeric loan account — contractId stays null for those).
export const checkLineItems = pgTable(
  "check_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    checkId: uuid("check_id").notNull().references(() => checks.id),
    contractId: uuid("contract_id").references(() => contracts.id),
    loanAccountRaw: text("loan_account_raw"),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    servicingFeeCents: bigint("servicing_fee_cents", { mode: "number" }).notNull().default(0),
    interestCents: bigint("interest_cents", { mode: "number" }).notNull().default(0),
    principalCents: bigint("principal_cents", { mode: "number" }).notNull().default(0),
    lateChargesCents: bigint("late_charges_cents", { mode: "number" }).notNull().default(0),
    chargesAmountCents: bigint("charges_amount_cents", { mode: "number" }).notNull().default(0),
    chargesInterestCents: bigint("charges_interest_cents", { mode: "number" }).notNull().default(0),
    otherPaymentsCents: bigint("other_payments_cents", { mode: "number" }).notNull().default(0),
  },
  (table) => [index("check_line_items_contract_id_idx").on(table.contractId)]
);
