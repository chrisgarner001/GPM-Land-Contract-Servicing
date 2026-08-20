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

    // Closing Statement prorations/fees — none of these appear in the Word
    // documents, only the Excel closing statement.
    //
    // Prorations are computed by the day-count engine in closingStatement.ts
    // from the full annual bill + period, not typed in as an already-computed
    // dollar split — see buildClosingStatementInput() in renderData.ts.
    earnest_money_deposit: "",
    property_tax_annual_amount: "",
    property_tax_period_start: "",
    property_tax_period_end: "",
    property_tax_status: "arrears", // MI property tax is billed in arrears
    property_tax_party: "buyer", // who will pay the bill when it comes due
    insurance_annual_amount: "",
    insurance_period_start: "",
    insurance_period_end: "",
    insurance_status: "prepaid", // an assumed policy the seller already paid for the year
    insurance_party: "seller", // who already paid it
    city_property_tax_annual_amount: "",
    city_property_tax_period_start: "",
    city_property_tax_period_end: "",
    city_property_tax_status: "arrears",
    city_property_tax_party: "buyer",
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
