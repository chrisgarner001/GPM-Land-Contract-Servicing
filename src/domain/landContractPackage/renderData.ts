import { isoToDisplay } from "@/domain/documents/isoDateFormat";
import { dollarsToWordsLowercase, numberToWordsLowercase } from "./numberToWords";
import type { Answers } from "./answers";
import { calculateEscrowReserveAmount, type ClosingStatementInput, type ReimbursementInput, type SimpleFee } from "./closingStatement";

export function dollarsToCents(value: string | undefined): number {
  const n = Math.round((Number(value) || 0) * 100);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(value: string | undefined): string {
  return (dollarsToCents(value) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const ONES_DIGITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

// "8.75" -> "eight point seven five"; "9" or "9.0" -> "nine". Every real
// example in the source documents used a whole rate ("nine percent"), but
// this business's contracts do carry fractional rates elsewhere in the app,
// so a decimal needs to read sensibly too.
function percentToWords(value: string | undefined): string {
  const rate = Number(value) || 0;
  const whole = Math.trunc(rate);
  const decimalStr = rate.toFixed(2).split(".")[1]; // "75", "50", "00"
  const wholeWords = numberToWordsLowercase(whole);
  if (decimalStr === "00") return wholeWords;
  const digitsWords = decimalStr.split("").map((d) => ONES_DIGITS[Number(d)]).join(" ");
  return `${wholeWords} point ${digitsWords}`;
}

function display(iso: string | undefined): string {
  return iso ? isoToDisplay(iso) : "";
}

// Produces every {tag} used across all 11 Word templates in
// src/document-templates/land-contract-package/ — they all share the same
// tag vocabulary (confirmed when the templates were built), so unlike the
// Deed Dashboard there's no per-document-family branching needed here.
export function buildDocxRenderData(a: Answers): Record<string, string> {
  return {
    // Buyer
    buyer_name: a.buyer_name ?? "",
    buyer_address: a.buyer_address ?? "",
    buyer_phone: a.buyer_phone ?? "",
    buyer_secondary_phone: a.buyer_secondary_phone ?? "",
    buyer_email: a.buyer_email ?? "",

    // Seller / Lender
    seller_name: a.seller_name ?? "",
    seller_name_caps: (a.seller_name ?? "").toUpperCase(),
    seller_address: a.seller_address ?? "",
    seller_signatory_name: a.seller_signatory_name ?? "",
    lender_name: a.lender_name ?? "",
    lender_address: a.lender_address ?? "",
    lender_nmls_id: a.lender_nmls_id ?? "",
    lender_signatory_name: a.lender_signatory_name ?? "",
    loan_originator_name: a.loan_originator_name ?? "",
    loan_originator_nmls: a.loan_originator_nmls ?? "",

    // Document preparer / attorney — the "This instrument was prepared by:"
    // block and the individual attorney's own name where a template
    // references them by name (e.g. "attorney {X}, Esq.").
    preparer_firm_name: a.preparer_firm_name ?? "",
    preparer_attorney_name: a.preparer_attorney_name ?? "",
    preparer_address_line1: a.preparer_address_line1 ?? "",
    preparer_city_state_zip: [a.preparer_city, [a.preparer_state, a.preparer_zip].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", "),
    title_fee: formatMoney(a.title_fee),

    // Property
    property_street: a.property_street ?? "",
    property_city: a.property_city ?? "",
    property_state: a.property_state ?? "",
    property_zip: a.property_zip ?? "",
    property_address: [a.property_street, a.property_city, [a.property_state, a.property_zip].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", "),
    property_county: a.property_county ?? "",
    notary_county: a.notary_county ?? "",
    // Always rendered as the "STATE OF MICHIGAN) / {this}) " jurat header —
    // every template kept the literal word "COUNTY" out of the tag, so it
    // has to come from here instead.
    notary_county_caps: a.notary_county ? `${a.notary_county.toUpperCase()} COUNTY` : "",
    legal_description: a.legal_description ?? "",
    parcel_id: a.parcel_id ?? "",
    municipality_type: a.municipality_type ?? "",
    municipality_name: a.municipality_name ?? "",
    account_number: a.account_number ?? "",

    // Financial terms
    purchase_price: formatMoney(a.purchase_price),
    purchase_price_words: dollarsToWordsLowercase(dollarsToCents(a.purchase_price)),
    down_payment: formatMoney(a.down_payment),
    down_payment_words: dollarsToWordsLowercase(dollarsToCents(a.down_payment)),
    original_principal: formatMoney(a.original_principal),
    original_principal_words: dollarsToWordsLowercase(dollarsToCents(a.original_principal)),
    interest_rate: a.interest_rate ?? "",
    interest_rate_words: percentToWords(a.interest_rate),
    default_interest_rate: a.default_interest_rate ?? "",
    default_interest_rate_words: percentToWords(a.default_interest_rate),
    monthly_pi_payment: formatMoney(a.monthly_pi_payment),
    monthly_pi_payment_words: dollarsToWordsLowercase(dollarsToCents(a.monthly_pi_payment)),
    monthly_escrow_payment: formatMoney(a.monthly_escrow_payment),
    monthly_escrow_payment_words: dollarsToWordsLowercase(dollarsToCents(a.monthly_escrow_payment)),
    total_monthly_payment: formatMoney(String(dollarsToCents(a.monthly_pi_payment) / 100 + dollarsToCents(a.monthly_escrow_payment) / 100)),
    first_payment_date: display(a.first_payment_date),
    amortization_months: a.amortization_months ?? "",
    balloon_date: display(a.balloon_date),
    late_fee_amount: formatMoney(a.late_fee_amount),
    late_fee_words: dollarsToWordsLowercase(dollarsToCents(a.late_fee_amount)),
    late_fee_grace_day: a.late_fee_grace_day ?? "",
    default_grace_days: a.default_grace_days ?? "",
    default_grace_days_words: a.default_grace_days ? numberToWordsLowercase(Number(a.default_grace_days) || 0) : "",

    // Closing details
    closing_date: display(a.closing_date),
    note_notary_date: display(a.note_notary_date),
    signing_city: a.signing_city ?? "",
    occupancy_primary_mark: a.occupancy_type === "PRIMARY" ? "X" : " ",
    occupancy_investment_mark: a.occupancy_type === "INVESTMENT" ? "X" : " ",
  };
}

// One-sided escrow reserve line for a bill the new impound account will pay
// out of later — see calculateEscrowReserveAmount's own doc comment for why
// this isn't a buyer/seller proration. Returns null when no annual amount was
// entered, so the fee simply doesn't appear.
function buildEscrowReserveFee(a: Answers, prefix: string, description: string, hasBillPeriod: boolean): SimpleFee | null {
  const annualAmount = dollarsToCents(a[`${prefix}_annual_amount`]) / 100;
  if (!annualAmount) return null;

  const billPeriodStart = hasBillPeriod ? a[`${prefix}_period_start`] || undefined : undefined;
  const firstPaymentDate = a.first_payment_date || a.closing_date || "";
  const cushionMonths = Number(a.escrow_cushion_months) || 2;

  return {
    description,
    amount: calculateEscrowReserveAmount({ annualAmount, billPeriodStart, firstPaymentDate, cushionMonths }),
  };
}

// Assembles the Closing Statement engine's input from the same flat Answers
// bucket the Word templates read from. Property tax / insurance / city
// property tax feed the buyer's own escrow reserve (a one-sided fee, not a
// seller proration) — everything else here is a straightforward one-sided
// fee or a paid-in-advance reimbursement, matching the fixed rows already on
// Closing Statement.xlsx.
export function buildClosingStatementInput(a: Answers): ClosingStatementInput {
  const propertyAddress = [a.property_street, a.property_city, [a.property_state, a.property_zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  const dollars = (v: string | undefined) => dollarsToCents(v) / 100;

  const commissions: SimpleFee[] = [];
  if (dollars(a.buyer_broker_commission)) {
    commissions.push({ description: `Buyer Broker Gross Commission- ${a.buyer_broker_name ?? ""}`, amount: dollars(a.buyer_broker_commission) });
  }
  if (dollars(a.listing_broker_commission)) {
    commissions.push({ description: `Listing Broker Commission: ${a.listing_broker_name ?? ""}`, amount: dollars(a.listing_broker_commission) });
  }

  const buyerFees: SimpleFee[] = [
    buildEscrowReserveFee(a, "property_tax", "Property Tax", true),
    buildEscrowReserveFee(a, "insurance", "Homeowner's Insurance Premium", false),
    buildEscrowReserveFee(a, "city_property_tax", "City Property Tax", true),
  ].filter((f): f is SimpleFee => f !== null);
  if (dollars(a.loan_origination_fee)) buyerFees.push({ description: "Loan Origination Fee: Success", amount: dollars(a.loan_origination_fee) });
  // Same bill the escrow reserve above is funding, not a separately-entered
  // amount — the buyer pays this year's premium in full at closing.
  if (dollars(a.insurance_annual_amount)) {
    buyerFees.push({ description: "Homeowner's Insurance Premium (12 Months)", amount: dollars(a.insurance_annual_amount) });
  }
  if (dollars(a.prepaid_interest)) buyerFees.push({ description: "Prepaid interest", amount: dollars(a.prepaid_interest) });

  const reimbursements: ReimbursementInput[] = [];
  if (dollars(a.city_taxes_paid_by_seller)) {
    reimbursements.push({ description: "City Town Taxes paid by seller", amount: dollars(a.city_taxes_paid_by_seller), paidBy: "seller" });
  }
  if (dollars(a.county_taxes_paid_by_seller)) {
    reimbursements.push({ description: "County Taxes paid by seller in advance", amount: dollars(a.county_taxes_paid_by_seller), paidBy: "seller" });
  }

  return {
    buyerName: a.buyer_name ?? "",
    sellerName: a.seller_name ?? "",
    propertyAddress,
    closingDate: a.closing_date ?? "",
    salePrice: dollars(a.purchase_price),
    earnestMoney: dollars(a.earnest_money_deposit),
    assumedExistingBalance: dollars(a.original_principal),
    sellerReceivesSalePriceInCash: false,
    commissions,
    buyerFees,
    reimbursements,
  };
}
