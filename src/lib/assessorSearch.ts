const BASE_URL = "https://api.assessorsearch.com";

function apiKey(): string {
  const key = process.env.ASSESSOR_SEARCH_API_KEY;
  if (!key) throw new Error("ASSESSOR_SEARCH_API_KEY is not set.");
  return key;
}

// Only the fields this app actually reads from AssessorSearch's property
// object — everything else is preserved as-is in the stored raw response.
interface RawProperty {
  property_id?: string | null;
  apn?: string | null;
  county?: string | null;
  owner_1_full_name?: string | null;
  assessed_value?: number | null;
  total_market_value?: number | null;
  estimated_market_value?: number | null;
  annual_tax_amount?: number | null;
  tax_year?: string | null;
  is_tax_exemption?: boolean | null;
  exemption_type?: string | null;
  delinquent_year?: string | null;
  last_sale_date?: string | null;
  last_sale_amount?: number | null;
  is_listed?: boolean | null;
  is_listed_date?: string | null;
  is_pre_foreclosure?: boolean | null;
  year_built?: string | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  lot_size_sqft?: number | null;
  legal_description?: string | null;
  combined_estimated_loan_balance?: number | null;
  estimated_equity?: number | null;
}

export interface AssessorPropertyRecord {
  assessorPropertyId: string | null;
  apn: string | null;
  county: string | null;
  ownerFullName: string | null;
  assessedValueCents: number | null;
  totalMarketValueCents: number | null;
  estimatedMarketValueCents: number | null;
  annualTaxAmountCents: number | null;
  taxYear: string | null;
  isTaxExemption: boolean | null;
  exemptionType: string | null;
  delinquentYear: string | null;
  lastSaleDate: string | null;
  lastSaleAmountCents: number | null;
  isListed: boolean | null;
  isListedDate: string | null;
  isPreForeclosure: boolean | null;
  yearBuilt: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSizeSqft: number | null;
  legalDescription: string | null;
  combinedEstimatedLoanBalanceCents: number | null;
  estimatedEquityCents: number | null;
  raw: unknown;
}

function dollarsToCents(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) : null;
}

// AssessorSearch returns e.g. "Wayne County, Michigan" — this app's own
// convention (see properties.county) is the bare county name ("Wayne").
export function normalizeCountyName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s+County\s*,.*$/i, "").trim();
  return cleaned || null;
}

function mapRecord(raw: RawProperty): AssessorPropertyRecord {
  return {
    assessorPropertyId: raw.property_id ?? null,
    apn: raw.apn ?? null,
    county: normalizeCountyName(raw.county),
    ownerFullName: raw.owner_1_full_name ?? null,
    assessedValueCents: dollarsToCents(raw.assessed_value),
    totalMarketValueCents: dollarsToCents(raw.total_market_value),
    estimatedMarketValueCents: dollarsToCents(raw.estimated_market_value),
    annualTaxAmountCents: dollarsToCents(raw.annual_tax_amount),
    taxYear: raw.tax_year ?? null,
    isTaxExemption: raw.is_tax_exemption ?? null,
    exemptionType: raw.exemption_type ?? null,
    delinquentYear: raw.delinquent_year ?? null,
    lastSaleDate: raw.last_sale_date ?? null,
    lastSaleAmountCents: dollarsToCents(raw.last_sale_amount),
    isListed: raw.is_listed ?? null,
    isListedDate: raw.is_listed_date ?? null,
    isPreForeclosure: raw.is_pre_foreclosure ?? null,
    yearBuilt: raw.year_built ?? null,
    beds: raw.beds ?? null,
    baths: raw.baths ?? null,
    sqft: raw.sqft ?? null,
    lotSizeSqft: raw.lot_size_sqft ?? null,
    legalDescription: raw.legal_description ?? null,
    combinedEstimatedLoanBalanceCents: dollarsToCents(raw.combined_estimated_loan_balance),
    estimatedEquityCents: dollarsToCents(raw.estimated_equity),
    raw,
  };
}

// The resolver endpoint wraps the property under a `property` key alongside
// `status`/`match`/`credits`; the by-ID endpoint may or may not — normalize
// both so callers don't need to know which shape they got.
async function callApi(path: string, params?: Record<string, string>): Promise<RawProperty | null> {
  const url = new URL(path, BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url, { headers: { "X-API-Key": apiKey() } });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? body);
    throw new Error(`AssessorSearch request failed (${res.status}): ${detail}`);
  }

  const body = await res.json();
  if (body.status && body.status !== "matched") return null;
  const property = (body.property ?? body) as RawProperty;
  return property?.property_id ? property : null;
}

// Resolves a free-form address to AssessorSearch's own property record.
// Costs 1 credit only when matched — an unmatched address is free.
export async function lookupPropertyByAddress(address: string): Promise<AssessorPropertyRecord | null> {
  const property = await callApi("/v1/properties", { address });
  return property ? mapRecord(property) : null;
}

// Refreshes a previously-matched property by AssessorSearch's own ID —
// more precise than re-resolving by address, and immune to the address
// text drifting from whatever originally matched.
export async function lookupPropertyById(assessorPropertyId: string): Promise<AssessorPropertyRecord | null> {
  const property = await callApi(`/v1/properties/${encodeURIComponent(assessorPropertyId)}`);
  return property ? mapRecord(property) : null;
}
