import Decimal from "decimal.js";

export interface MichiganTransferTax {
  stateTaxCents: number;
  countyTaxCents: number;
  totalTaxCents: number;
}

// Michigan real estate transfer tax: $3.75 state + $0.55 county per $500
// increment of the sale price, rounded UP to the next increment — ported
// verbatim from the standalone Quitclaim Deed Dashboard's calcTransferTax().
export function calculateMichiganTransferTax(salePriceCents: number): MichiganTransferTax {
  const units = new Decimal(salePriceCents).dividedBy(50_000).ceil();
  const stateTaxCents = units.mul(375).toNumber();
  const countyTaxCents = units.mul(55).toNumber();
  return { stateTaxCents, countyTaxCents, totalTaxCents: stateTaxCents + countyTaxCents };
}
