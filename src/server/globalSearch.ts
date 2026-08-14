import { and, eq, ilike, or, gt } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts, contractParties } from "@/db/schema/contracts";
import { parties, properties } from "@/db/schema/parties";
import { vendors } from "@/db/schema/vendors";

export interface GlobalSearchResult {
  id: string;
  label: string;
  sublabel: string | null;
  href: string;
}

export interface GlobalSearchResults {
  contracts: GlobalSearchResult[];
  properties: GlobalSearchResult[];
  borrowers: GlobalSearchResult[];
  lenders: GlobalSearchResult[];
  vendors: GlobalSearchResult[];
}

const RESULT_LIMIT = 5;

// One query per entity type rather than a single UNION — each has a
// different shape/join and a small independent cap, and this is typed
// directly off a plain search box keystroke (debounced client-side) so
// total latency matters more than round-trip count.
export async function searchGlobal(rawQuery: string): Promise<GlobalSearchResults> {
  const query = rawQuery.trim();
  if (query.length < 2) {
    return { contracts: [], properties: [], borrowers: [], lenders: [], vendors: [] };
  }
  const pattern = `%${query}%`;

  const [contractRows, propertyRows, borrowerRows, lenderRows, vendorRows] = await Promise.all([
    db
      .select({
        id: contracts.id,
        contractNumber: contracts.contractNumber,
        buyerName: parties.displayName,
        streetAddress: properties.streetAddress,
      })
      .from(contracts)
      .leftJoin(contractParties, and(eq(contractParties.contractId, contracts.id), eq(contractParties.role, "BUYER")))
      .leftJoin(parties, eq(contractParties.partyId, parties.id))
      .leftJoin(properties, eq(contracts.propertyId, properties.id))
      .where(or(ilike(contracts.contractNumber, pattern), ilike(parties.displayName, pattern), ilike(properties.streetAddress, pattern)))
      .limit(RESULT_LIMIT),
    db
      .select({
        id: properties.id,
        streetAddress: properties.streetAddress,
        city: properties.city,
        state: properties.state,
        zip: properties.zip,
      })
      .from(properties)
      .where(
        or(
          ilike(properties.streetAddress, pattern),
          ilike(properties.city, pattern),
          ilike(properties.county, pattern),
          ilike(properties.zip, pattern)
        )
      )
      .limit(RESULT_LIMIT),
    db
      .selectDistinct({ id: parties.id, displayName: parties.displayName })
      .from(parties)
      .innerJoin(contractParties, and(eq(contractParties.partyId, parties.id), eq(contractParties.role, "BUYER")))
      .where(ilike(parties.displayName, pattern))
      .limit(RESULT_LIMIT),
    db
      .selectDistinct({ id: parties.id, displayName: parties.displayName })
      .from(parties)
      .innerJoin(contractParties, and(eq(contractParties.partyId, parties.id), eq(contractParties.role, "INVESTOR_PAYEE")))
      .where(and(ilike(parties.displayName, pattern), gt(contractParties.ownershipPercent, "0")))
      .limit(RESULT_LIMIT),
    db
      .select({ id: vendors.id, displayName: vendors.displayName, vendorAccountCode: vendors.vendorAccountCode })
      .from(vendors)
      .where(or(ilike(vendors.displayName, pattern), ilike(vendors.vendorAccountCode, pattern)))
      .limit(RESULT_LIMIT),
  ]);

  return {
    contracts: contractRows.map((r) => ({
      id: r.id,
      label: r.contractNumber,
      sublabel: r.buyerName ?? r.streetAddress,
      href: `/contracts/${r.id}`,
    })),
    properties: propertyRows.map((r) => ({
      id: r.id,
      label: r.streetAddress,
      sublabel: `${r.city}, ${r.state} ${r.zip}`,
      href: `/properties/${r.id}`,
    })),
    borrowers: borrowerRows.map((r) => ({ id: r.id, label: r.displayName, sublabel: null, href: `/borrowers/${r.id}` })),
    lenders: lenderRows.map((r) => ({ id: r.id, label: r.displayName, sublabel: null, href: `/lenders/${r.id}` })),
    vendors: vendorRows.map((r) => ({
      id: r.id,
      label: r.displayName,
      sublabel: r.vendorAccountCode,
      href: `/vendors/${r.id}`,
    })),
  };
}
