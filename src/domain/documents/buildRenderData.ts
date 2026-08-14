import { calculateMichiganTransferTax } from "./transferTax";
import { amountCentsToWords } from "./numberToWords";
import { isoToDisplay, isoDay, isoMonth, isoYear } from "./isoDateFormat";
import type { DeedType } from "./generateDeedDocx";
import type { DeedPrefillData } from "@/server/documents";

export type Fields = Record<string, string>;
export type Family = "standard" | "qcdlc" | "lca";

export function familyOf(deedType: DeedType): Family {
  if (deedType === "QCDLC") return "qcdlc";
  if (deedType === "LCA") return "lca";
  return "standard";
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// Fields resolved from a specific land contract (current lender, buyer,
// property, LC financials) rather than typed once and shared across every
// document in a batch — see applyContractPrefill. Grantor/property/buyer are
// per-contract for every type. Grantee name/address are ALSO per-contract
// only for WD/WDS — a payoff Warranty Deed's grantee is that specific
// contract's own buyer, unlike QCD/LC/QCDLC/LCA where the grantee/assignee
// is a different, not-yet-in-the-system entity typed once for the whole
// batch. Grantee TYPE stays a manual, shared field even for WD/WDS: a
// buyer's own party record only distinguishes INDIVIDUAL vs BUSINESS, which
// can't reliably tell a single owner from joint owners, or joint tenants
// from a married couple — guessing wrong on a real recorded deed is worse
// than asking staff to pick. Sale price is per-contract only for WDS, driven
// by that contract's own original purchase price — QCDLC's sale_price is a
// different real transaction (the lender's own interest being sold) and
// stays a shared, manually-entered value.
export function getPerContractKeys(deedType: DeedType): string[] {
  const base = ["grantor_name", "grantor_type", "grantor_address", "buyer_name", "buyer_address",
    "loc_name", "county", "street_address", "parcel_ids", "legal_description",
    "lc_date", "lc_balance", "interest_rate", "interest_paid_through"];
  if (deedType === "WD" || deedType === "WDS") base.push("grantee_name", "grantee_address");
  if (deedType === "WDS") base.push("sale_price");
  return base;
}

// The drafter/return/tax contact and notary state default to this
// deployment's own Company Settings (Setup > Company Settings) rather than
// a hardcoded person/address, so a white-labeled deployment for a
// different servicing company only needs different settings data, not a
// code change. Callers that don't care about real generation output (e.g.
// the batch preview endpoint) can omit `companyDefaults` and get blanks.
export function buildDefaultFields(companyDefaults?: {
  contactName: string;
  contactAddress: string;
  contactCsz: string;
  notaryState: string;
}): Fields {
  const todayIso = new Date().toISOString().slice(0, 10);
  const contactName = companyDefaults?.contactName ?? "";
  const contactAddress = companyDefaults?.contactAddress ?? "";
  const contactCsz = companyDefaults?.contactCsz ?? "";
  const notaryStateDefault = companyDefaults?.notaryState ?? "";
  return {
    drafter_name: contactName,
    drafter_address: contactAddress,
    drafter_csz: contactCsz,
    return_name: contactName,
    return_address: contactAddress,
    return_csz: contactCsz,
    tax_name: contactName,
    tax_address: contactAddress,
    tax_csz: contactCsz,
    grantor_name: "",
    grantor_type: "",
    grantor_address: "",
    signatory_name: "",
    signatory_title: "",
    grantee_name: "",
    grantee_type: "",
    grantee_address: "",
    buyer_name: "",
    buyer_address: "",
    deed_date: todayIso,
    consideration: "less than $100.00 and other good and valuable consideration",
    sale_price: "",
    loc_type: "Township",
    loc_name: "",
    county: "",
    street_address: "",
    parcel_ids: "",
    legal_description: "",
    mcl_state: "a",
    mcl_county: "p)(ii",
    notary_day: "",
    notary_month: "",
    notary_year: "",
    notary_name: "",
    notary_state: notaryStateDefault,
    notary_county: "",
    acting_county: "",
    commission_expires: "",
    lc_interest: "",
    lc_date: "",
    lc_recording_date: "",
    lc_liber: "",
    lc_page: "",
    assignment_county: "",
    assignment_liber: "",
    assignment_page: "",
    ack_date: "",
    ack_county: "",
    effective_date: todayIso,
    lc_balance: "",
    interest_rate: "",
    interest_paid_through: "",
    assignee_signatory_name: "",
    assignee_signatory_title: "",
    assignee_notary_state: notaryStateDefault,
    assignee_notary_county: "",
    assignee_ack_date: "",
    assignee_commission_expires: "",
  };
}

// Overrides the per-contract keys (see getPerContractKeys) on top of the
// given (shared) fields with a specific land contract's own data — used
// server-side, once per contract, when generating a batch. Grantor/Seller
// is always the contract's current lender; Buyer is always the contract's
// own borrower — neither is ever a "typed once, shared across the batch"
// value, since a different contract can have a different lender.
export function applyContractPrefill(fields: Fields, prefill: DeedPrefillData, deedType: DeedType): Fields {
  const lender = prefill.currentLenders[0] ?? null;
  const streetAddress = [prefill.streetAddress, prefill.city, [prefill.state].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  const isPayoffDeed = deedType === "WD" || deedType === "WDS";

  return {
    ...fields,
    grantor_name: lender?.displayName ?? "",
    grantor_type: lender ? "a Michigan Limited Liability Company" : "",
    grantor_address: lender?.fullAddress ?? "",
    ...(isPayoffDeed
      ? {
          grantee_name: prefill.buyer?.displayName ?? "",
          grantee_address: prefill.buyer?.fullAddress ?? "",
        }
      : {}),
    buyer_name: prefill.buyer?.displayName ?? "",
    buyer_address: prefill.buyer?.fullAddress ?? "",
    loc_name: prefill.city ?? "",
    county: prefill.county ?? "",
    street_address: streetAddress,
    parcel_ids: prefill.parcelNumber ?? "",
    legal_description: prefill.legalDescription ?? "",
    lc_date: prefill.originationDate ?? "",
    lc_balance: (prefill.currentPrincipalBalanceCents / 100).toFixed(2),
    interest_rate: prefill.interestRateAnnual ?? "",
    interest_paid_through: prefill.lastPaymentDate ? isoToDisplay(prefill.lastPaymentDate) : "",
    ...(deedType === "WDS" ? { sale_price: (prefill.purchasePriceCents / 100).toFixed(2) } : {}),
  };
}

export function buildRenderData(deedType: DeedType, f: Fields): Record<string, string> {
  const display = (iso: string) => (iso ? isoToDisplay(iso) : "");

  if (deedType === "QCDLC") {
    const salePriceCents = Math.round((Number(f.sale_price) || 0) * 100);
    const tax = calculateMichiganTransferTax(salePriceCents);
    return {
      drafted_by: f.drafter_name,
      return_to: [f.return_name, f.return_address, f.return_csz].filter(Boolean).join(", "),
      grantor_name: f.grantor_name,
      grantor_address: f.grantor_address,
      grantee_name: f.grantee_name,
      grantee_address: f.grantee_address,
      municipality_type: f.loc_type,
      municipality_name: f.loc_name,
      property_county: f.county,
      parcel_id: f.parcel_ids,
      property_address: f.street_address,
      legal_description: f.legal_description,
      county_transfer_tax: (tax.countyTaxCents / 100).toFixed(2),
      state_transfer_tax: (tax.stateTaxCents / 100).toFixed(2),
      consideration_figures: (salePriceCents / 100).toFixed(2),
      consideration_words: amountCentsToWords(salePriceCents),
      land_contract_date: display(f.lc_date),
      purchaser_name: f.buyer_name,
      assignment_county: f.assignment_county,
      assignment_liber: f.assignment_liber,
      assignment_page: f.assignment_page,
      deed_date: display(f.deed_date),
      signatory_name: f.signatory_name,
      signatory_title: f.signatory_title,
      ack_date: display(f.ack_date || f.deed_date),
      ack_county: f.ack_county || f.county,
      notary_county: f.notary_county || f.county,
      commission_expires: f.commission_expires,
    };
  }

  if (deedType === "LCA") {
    return {
      effective_date: display(f.effective_date),
      seller_name: f.grantor_name,
      seller_type: f.grantor_type,
      seller_address: f.grantor_address,
      assignee_name: f.grantee_name,
      assignee_type: f.grantee_type,
      assignee_address: f.grantee_address,
      lc_date: display(f.lc_date),
      buyer_name: f.buyer_name,
      buyer_address: f.buyer_address,
      city: f.loc_name,
      county: f.county,
      legal_description: f.legal_description,
      parcel_id: f.parcel_ids,
      street_address: f.street_address,
      lc_balance: f.lc_balance,
      interest_rate: f.interest_rate,
      interest_paid_through: f.interest_paid_through,
      signing_date: display(f.deed_date),
      seller_signatory_name: f.signatory_name,
      seller_signatory_title: f.signatory_title,
      seller_notary_state: f.notary_state || "Michigan",
      seller_notary_county: f.notary_county || f.county,
      seller_commission_expires: f.commission_expires,
      assignee_signatory_name: f.assignee_signatory_name,
      assignee_signatory_title: f.assignee_signatory_title,
      assignee_notary_state: f.assignee_notary_state,
      assignee_notary_county: f.assignee_notary_county,
      assignee_ack_date: display(f.assignee_ack_date || f.deed_date),
      assignee_commission_expires: f.assignee_commission_expires,
      drafter_name: f.drafter_name,
      drafter_address: f.drafter_address,
      drafter_csz: f.drafter_csz,
    };
  }

  // QCD / WD / WDS / LC all share the same tag vocabulary.
  const salePriceCents = deedType === "WDS" ? Math.round((Number(f.sale_price) || 0) * 100) : 0;
  const consideration = deedType === "WDS" && salePriceCents > 0 ? formatCents(salePriceCents) : f.consideration;

  return {
    deed_date: display(f.deed_date),
    grantor_name: f.grantor_name,
    grantor_type: f.grantor_type,
    grantor_address: f.grantor_address,
    signatory_name: f.signatory_name,
    signatory_title: f.signatory_title,
    grantee_name: f.grantee_name,
    grantee_type: f.grantee_type,
    grantee_address: f.grantee_address,
    consideration,
    loc_type: f.loc_type,
    loc_name: f.loc_name,
    county: f.county,
    street_address: f.street_address,
    parcel_ids: f.parcel_ids,
    legal_description: f.legal_description,
    mcl_state: (f.mcl_state || "__").replace(/^\(|\)$/g, ""),
    mcl_county: (f.mcl_county || "__").replace(/^\(|\)$/g, ""),
    sign_day: isoDay(f.deed_date),
    sign_month: isoMonth(f.deed_date),
    sign_year: isoYear(f.deed_date),
    notary_day: f.notary_day || isoDay(f.deed_date),
    notary_month: f.notary_month || isoMonth(f.deed_date),
    notary_year: f.notary_year || isoYear(f.deed_date),
    notary_name: f.notary_name,
    notary_county: f.notary_county || f.county,
    acting_county: f.acting_county || f.county,
    commission_expires: f.commission_expires,
    drafter_name: f.drafter_name,
    drafter_address: f.drafter_address,
    drafter_csz: f.drafter_csz,
    return_name: f.return_name || f.grantee_name,
    return_address: f.return_address || f.grantee_address,
    return_csz: f.return_csz,
    tax_name: f.tax_name || f.grantee_name,
    tax_address: f.tax_address || f.grantee_address,
    tax_csz: f.tax_csz,
    lc_interest: f.lc_interest,
    lc_date: display(f.lc_date),
    lc_recording_date: display(f.lc_recording_date),
    lc_liber: f.lc_liber,
    lc_page: f.lc_page,
  };
}

export const REQUIRED_BY_FAMILY: Record<Family, string[]> = {
  standard: [
    "grantor_name", "grantor_type", "grantor_address", "signatory_name",
    "grantee_name", "grantee_type", "grantee_address", "deed_date", "consideration",
    "loc_name", "county", "street_address", "parcel_ids", "legal_description",
  ],
  qcdlc: [
    "grantor_name", "grantor_address", "grantee_name", "grantee_address",
    "signatory_name", "deed_date", "county", "street_address", "parcel_ids", "legal_description", "buyer_name",
  ],
  lca: [
    "grantor_name", "grantor_type", "grantor_address", "grantee_name", "grantee_type", "grantee_address",
    "buyer_name", "buyer_address", "lc_date", "county", "street_address", "parcel_ids", "legal_description", "deed_date",
  ],
};
