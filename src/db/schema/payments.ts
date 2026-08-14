import { pgTable, uuid, text, timestamp, bigint, date, pgEnum, boolean } from "drizzle-orm/pg-core";
import { contracts } from "./contracts";

export const paymentMethodEnum = pgEnum("payment_method", [
  "CHECK",
  "CASH",
  "ACH",
  "CARD",
  "PAID_ONLINE",
  "ADJUSTMENT",
  // Historical payments migrated from The Mortgage Office where the original
  // collection method isn't reliably known from the export.
  "LEGACY_IMPORT",
]);

export const paymentStatusEnum = pgEnum("payment_status", ["PENDING", "CLEARED", "REVERSED", "NSF"]);

export const allocationTypeEnum = pgEnum("allocation_type", [
  "PRINCIPAL",
  "INTEREST",
  "ESCROW_TAX",
  "ESCROW_INSURANCE",
  "LATE_FEE",
  "OTHER_FEE",
  "SUSPENSE",
]);

// Append-only ledger. Once a row is CLEARED, its amount and allocations must
// never be updated/deleted by the app — corrections insert a new offsetting
// row referencing reversedPaymentId instead.
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contract_id").notNull().references(() => contracts.id),
  receivedDate: date("received_date").notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull().default("LEGACY_IMPORT"),
  referenceNumber: text("reference_number"),
  status: paymentStatusEnum("status").notNull().default("CLEARED"),
  externalPlatformRef: text("external_platform_ref"),
  reversedPaymentId: uuid("reversed_payment_id"),
  // Null = no hold (all historical/imported rows). Set automatically on
  // insert for real app-recorded payments — the lender's credit for this
  // payment isn't eligible for a Lender Payment Run until this date, unless
  // releaseOverride is set on that specific run.
  releaseDate: date("release_date"),
  releaseOverride: boolean("release_override").notNull().default(false),
  // Verbatim source description (e.g. "Payoff", "NSF", "Funds Advanced") —
  // TMO's own transaction label, kept for audit traceability since it carries
  // nuance our allocationType enum doesn't fully capture.
  legacyDescription: text("legacy_description"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  notes: text("notes"),
});

export const paymentAllocations = pgTable("payment_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentId: uuid("payment_id").notNull().references(() => payments.id),
  allocationType: allocationTypeEnum("allocation_type").notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
});
