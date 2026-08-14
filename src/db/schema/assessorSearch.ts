import { pgTable, uuid, text, timestamp, bigint, integer, numeric, boolean, date, jsonb } from "drizzle-orm/pg-core";
import { properties } from "./parties";

// Append-only — one row per successful AssessorSearch lookup, never
// overwritten. Keeping history (rather than upserting a single row per
// property) lets a future periodic sweep diff the newest snapshot against
// the previous one to detect what actually changed (newly listed, tax
// changed, value changed) instead of only ever seeing the latest state.
// The property page always reads the most recent row per property.
export const propertyAssessorSnapshots = pgTable("property_assessor_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id").notNull().references(() => properties.id),

  // AssessorSearch's own property_id — lets a refresh call
  // GET /v1/properties/{property_id} directly instead of re-resolving by
  // address, which could match a different record if the address changed.
  assessorPropertyId: text("assessor_property_id"),
  apn: text("apn"),
  county: text("county"),
  ownerFullName: text("owner_full_name"),

  assessedValueCents: bigint("assessed_value_cents", { mode: "number" }),
  totalMarketValueCents: bigint("total_market_value_cents", { mode: "number" }),
  estimatedMarketValueCents: bigint("estimated_market_value_cents", { mode: "number" }),
  annualTaxAmountCents: bigint("annual_tax_amount_cents", { mode: "number" }),
  taxYear: text("tax_year"),
  isTaxExemption: boolean("is_tax_exemption"),
  exemptionType: text("exemption_type"),
  delinquentYear: text("delinquent_year"),

  lastSaleDate: date("last_sale_date"),
  lastSaleAmountCents: bigint("last_sale_amount_cents", { mode: "number" }),

  isListed: boolean("is_listed"),
  isListedDate: date("is_listed_date"),
  isPreForeclosure: boolean("is_pre_foreclosure"),

  yearBuilt: text("year_built"),
  beds: integer("beds"),
  baths: numeric("baths", { precision: 4, scale: 1 }),
  sqft: integer("sqft"),
  lotSizeSqft: integer("lot_size_sqft"),
  legalDescription: text("legal_description"),

  combinedEstimatedLoanBalanceCents: bigint("combined_estimated_loan_balance_cents", { mode: "number" }),
  estimatedEquityCents: bigint("estimated_equity_cents", { mode: "number" }),

  // Full raw API response — anything not modeled above stays recoverable
  // without a migration every time AssessorSearch adds a field.
  rawResponse: jsonb("raw_response").notNull(),

  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});
