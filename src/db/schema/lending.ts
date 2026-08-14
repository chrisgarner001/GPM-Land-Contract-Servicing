import { pgTable, uuid, text, date, bigint, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { parties } from "./parties";
import { contracts } from "./contracts";
import { payments } from "./payments";

export const lenderLedgerEntryTypeEnum = pgEnum("lender_ledger_entry_type", [
  "PAYMENT_CREDIT",
  "CHARGE_CREDIT",
  "CHARGE_DEBIT",
  "DISTRIBUTION",
]);

/**
 * Per-LENDER clearing ledger — confirmed live in TMO's "All Lenders" > Trust
 * Ledger. Deliberately keyed on the lender (party), not the contract: a
 * single lender's ledger aggregates deposits from every contract they fund.
 * Each borrower payment credits this ledger with the lender's net share of
 * principal + interest + any late fee (payment × ownershipPercent −
 * brokerServicingFeeCents, computed per contract — see
 * contractParties.brokerServicingFeeCents; late fees belong to the lender,
 * confirmed against real usage — OTHER_FEE allocations do not and stay with
 * SGMS), and the
 * accumulated balance is periodically swept out via a "Lender Check" entry
 * (sourceContractId null, description "Lender Check"). Payoffs flow through
 * the same mechanism as regular payments.
 */
export const lenderLedgerEntries = pgTable("lender_ledger_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  lenderPartyId: uuid("lender_party_id").notNull().references(() => parties.id),
  // Which contract this credit came from. Null for outbound "Lender Check"
  // distribution rows, which sweep the accumulated balance across contracts.
  sourceContractId: uuid("source_contract_id").references(() => contracts.id),
  transactionDate: date("transaction_date").notNull(),
  reference: text("reference"),
  description: text("description"),
  amountPaidOutCents: bigint("amount_paid_out_cents", { mode: "number" }),
  amountReceivedCents: bigint("amount_received_cents", { mode: "number" }),
  balanceCents: bigint("balance_cents", { mode: "number" }),
  // Classifies the row so "everything since the last sweep" can be found
  // reliably instead of pattern-matching description text. Null on rows that
  // predate this column (backfilled by migration — see 00xx_*.sql).
  entryType: lenderLedgerEntryTypeEnum("entry_type"),
  // PAYMENT_CREDIT only — the regular borrower payment this credit came
  // from, so a reversal can find and undo exactly this row, and so Lender
  // Payment Runs can show the real payment date instead of relying on
  // transactionDate alone.
  sourcePaymentId: uuid("source_payment_id").references(() => payments.id),
  // PAYMENT_CREDIT only — an immutable snapshot of this credit's breakdown
  // at the time it was posted (ownership % and the flat servicing fee can
  // both change later via contractParties funding history, so this must
  // never be recomputed from current data at display time).
  interestCents: bigint("interest_cents", { mode: "number" }),
  principalCents: bigint("principal_cents", { mode: "number" }),
  servicingFeeCents: bigint("servicing_fee_cents", { mode: "number" }),
  // PAYMENT_CREDIT only — the lender's ownership-weighted share of any
  // LATE_FEE allocation on the source payment, already folded into
  // amountReceivedCents (late fees are lender revenue, not SGMS's — unlike
  // OTHER_FEE, which stays with SGMS and is never part of this ledger).
  // Null on rows that predate this column.
  lateFeeCents: bigint("late_fee_cents", { mode: "number" }),
  // Real insertion instant — the sweep floor (see lenderPaymentRuns.ts) must
  // compare THIS, not transactionDate, to tell "already swept" from "still
  // outstanding." transactionDate is a plain date with no time component,
  // so two rows dated the same calendar day (a payment credited right after
  // that same lender's distribution was just processed, say) can never be
  // ordered against each other by date alone — the later one would forever
  // read as "on or before the floor," permanently invisible to every future
  // sweep. Defaults to now() for historical rows (order among them doesn't
  // matter, they're all already-settled pre-this-feature activity) and gets
  // a real distinct value on every row inserted from here on.
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
