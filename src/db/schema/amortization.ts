import { pgTable, uuid, text, timestamp, bigint, integer, date, numeric, unique } from "drizzle-orm/pg-core";
import { contracts } from "./contracts";

export const amortizationScheduleVersions = pgTable("amortization_schedule_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contract_id").notNull().references(() => contracts.id),
  versionNumber: integer("version_number").notNull(),
  effectiveDate: date("effective_date").notNull(),
  reason: text("reason").notNull(), // e.g. "ORIGINATION", "MODIFICATION", "RE_AMORTIZATION"
  principalBalanceAtStartCents: bigint("principal_balance_at_start_cents", { mode: "number" }).notNull(),
  interestRateAnnual: numeric("interest_rate_annual", { precision: 7, scale: 4 }).notNull(),
  amortizationTermMonths: integer("amortization_term_months").notNull(),
  numberOfPayments: integer("number_of_payments").notNull(),
  paymentAmountCents: bigint("payment_amount_cents", { mode: "number" }).notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  // Only one version per contract should have supersededAt null (the active version).
  supersededAt: timestamp("superseded_at", { withTimezone: true }),
});

export const scheduledPayments = pgTable(
  "scheduled_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scheduleVersionId: uuid("schedule_version_id")
      .notNull()
      .references(() => amortizationScheduleVersions.id),
    periodNumber: integer("period_number").notNull(),
    dueDate: date("due_date").notNull(),
    beginningBalanceCents: bigint("beginning_balance_cents", { mode: "number" }).notNull(),
    scheduledInterestCents: bigint("scheduled_interest_cents", { mode: "number" }).notNull(),
    scheduledPrincipalCents: bigint("scheduled_principal_cents", { mode: "number" }).notNull(),
    scheduledEscrowCents: bigint("scheduled_escrow_cents", { mode: "number" }),
    scheduledTotalCents: bigint("scheduled_total_cents", { mode: "number" }).notNull(),
    endingBalanceCents: bigint("ending_balance_cents", { mode: "number" }).notNull(),
  },
  (table) => [unique().on(table.scheduleVersionId, table.periodNumber)]
);
