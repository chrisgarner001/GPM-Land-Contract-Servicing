// Every field the Create Land Contract Package Q&A collects, keyed exactly
// like the document templates' {tag} names. Flat string map (mirroring the
// Deed Dashboard's Fields type) since this is a form edited as a whole and
// persisted as JSON — no benefit to a fully-typed shape here.
export type Answers = Record<string, string>;

export function buildDefaultAnswers(): Answers {
  const todayIso = new Date().toISOString().slice(0, 10);
  return {
    // Buyer
    buyer_name: "",
    buyer_address: "",
    buyer_phone: "",
    buyer_secondary_phone: "",
    buyer_email: "",
    buyer_ssn_last4: "",
    co_buyer_name: "",
    co_buyer_ssn_last4: "",

    // Seller — the funding LLC, the "Vendor"/"Seller" on these documents.
    seller_name: "",
    seller_address: "",
    seller_signatory_name: "",
    // This deployment's own servicing/lending entity — defaults from
    // Setup > Company Settings (see src/server/companySettings.ts), not
    // hardcoded, so the "Lender" identity varies per deployment/company.
    // The entity itself is effectively fixed for a given deployment, but
    // who signs on its behalf can vary per package.
    lender_name: "",
    lender_address: "",
    lender_nmls_id: "",
    lender_signatory_name: "",
    loan_originator_name: "",
    loan_originator_nmls: "",

    // Document preparer/attorney — also defaults from Company Settings.
    preparer_firm_name: "",
    preparer_attorney_name: "",
    preparer_address_line1: "",
    preparer_city: "",
    preparer_state: "",
    preparer_zip: "",
    title_fee: "",

    // Property
    property_street: "",
    property_city: "",
    property_state: "MI",
    property_zip: "",
    property_county: "",
    legal_description: "",
    parcel_id: "",
    municipality_type: "City",
    municipality_name: "",

    // Financial terms
    purchase_price: "",
    down_payment: "",
    original_principal: "",
    interest_rate: "",
    default_interest_rate: "13",
    monthly_pi_payment: "",
    monthly_escrow_payment: "",
    first_payment_date: "",
    amortization_months: "360",
    balloon_date: "",
    late_fee_amount: "75",
    late_fee_grace_day: "10",
    default_grace_days: "45",

    // Closing details
    closing_date: todayIso,
    note_notary_date: todayIso,
    signing_city: "Taylor",
    notary_county: "Wayne",
    account_number: "",
    // PRIMARY | INVESTMENT — drives Borrower Certifications' occupancy marks.
    occupancy_type: "PRIMARY",

    // Closing Statement fees — none of these appear in the Word documents,
    // only the Excel closing statement.
    //
    // Property tax / insurance / city property tax fund the BUYER's own new
    // escrow/impound reserve (never a seller proration) — the annual bill
    // divided by 12 becomes the ongoing monthly_escrow_payment, and a lump
    // sum (the accrual gap since the bill period started, plus a cushion) is
    // collected at closing. See calculateEscrowReserveAmount() in
    // closingStatement.ts and the methodology call with Jim Woodworth on
    // 8/20/26 in the shared drive. Insurance has no bill-period-start — the
    // buyer brings a paid-current policy to closing, so only the cushion
    // applies.
    earnest_money_deposit: "",
    escrow_cushion_months: "2",
    property_tax_annual_amount: "",
    property_tax_period_start: "",
    insurance_annual_amount: "",
    city_property_tax_annual_amount: "",
    city_property_tax_period_start: "",
    buyer_broker_name: "",
    buyer_broker_commission: "",
    listing_broker_name: "",
    listing_broker_commission: "",
    loan_origination_fee: "",
    annual_insurance_premium: "",
    prepaid_interest: "",
    city_taxes_paid_by_seller: "",
    county_taxes_paid_by_seller: "",

    // PTA (Form 2766) / PRE (Form 2368) specific — items 10-19 on the PTA
    // are genuinely optional per the form itself.
    occupancy_percent: "100",
    purchased_from_financial_institution: "No",
    related_party_transfer: "No",
    financed_at_market_rate: "Yes",
  };
}
