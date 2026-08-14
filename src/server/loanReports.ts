import { and, eq, desc, gt, isNull, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts, contractParties, loanTypeEnum } from "@/db/schema/contracts";
import { parties, properties } from "@/db/schema/parties";
import { propertyAssessorSnapshots } from "@/db/schema/assessorSearch";

export const LOAN_TYPE_LABELS: Record<string, string> = {
  LAND_CONTRACT: "Land Contract",
  FIRST_LIEN: "1st Lien",
  SECOND_LIEN: "2nd Lien",
  UNSECURED: "Unsecured",
};

interface BaseRow {
  contractId: string;
  contractNumber: string;
  loanType: (typeof loanTypeEnum.enumValues)[number];
  borrowerName: string | null;
  // First BUYER party's own contact info — a CRM export needs one contact
  // record per lead, not every co-buyer's, so this deliberately isn't the
  // full joined list borrowerName is.
  borrowerEmail: string | null;
  borrowerPhone: string | null;
  lenderName: string | null;
  propertyAddress: string;
  county: string;
  currentPrincipalBalanceCents: number;
  snapshot: {
    estimatedMarketValueCents: number | null;
    isListed: boolean | null;
    isListedDate: string | null;
    fetchedAt: Date;
  } | null;
}

// Every ACTIVE contract joined to its property and the property's most
// recent AssessorSearch snapshot (if any) — the shared base both
// getEquityAnalysis and getListedForSaleProperties filter/shape from, so the
// active-contract + property + latest-snapshot + borrower/lender assembly
// only happens in one place. `loanTypeFilter` narrows to one loan type when
// the caller only cares about a subset (e.g. equity-refi marketing is
// meaningless for a loan that isn't structured as a land contract).
async function getActiveContractsWithAssessorData(loanTypeFilter?: (typeof loanTypeEnum.enumValues)[number]): Promise<BaseRow[]> {
  const contractRows = await db
    .select({
      id: contracts.id,
      contractNumber: contracts.contractNumber,
      loanType: contracts.loanType,
      currentPrincipalBalanceCents: contracts.currentPrincipalBalanceCents,
      propertyId: contracts.propertyId,
    })
    .from(contracts)
    .where(loanTypeFilter ? and(eq(contracts.status, "ACTIVE"), eq(contracts.loanType, loanTypeFilter)) : eq(contracts.status, "ACTIVE"));

  const propertyIds = [...new Set(contractRows.map((c) => c.propertyId).filter((id): id is string => !!id))];
  const contractIds = contractRows.map((c) => c.id);

  const propertyRows = propertyIds.length
    ? await db
        .select({
          id: properties.id,
          streetAddress: properties.streetAddress,
          city: properties.city,
          state: properties.state,
          zip: properties.zip,
          county: properties.county,
        })
        .from(properties)
        .where(inArray(properties.id, propertyIds))
    : [];
  const propertyById = new Map(propertyRows.map((p) => [p.id, p]));

  const snapshotRows = propertyIds.length
    ? await db
        .select({
          propertyId: propertyAssessorSnapshots.propertyId,
          estimatedMarketValueCents: propertyAssessorSnapshots.estimatedMarketValueCents,
          isListed: propertyAssessorSnapshots.isListed,
          isListedDate: propertyAssessorSnapshots.isListedDate,
          fetchedAt: propertyAssessorSnapshots.fetchedAt,
        })
        .from(propertyAssessorSnapshots)
        .where(inArray(propertyAssessorSnapshots.propertyId, propertyIds))
        .orderBy(desc(propertyAssessorSnapshots.fetchedAt))
    : [];
  const latestSnapshotByProperty = new Map<string, BaseRow["snapshot"]>();
  for (const s of snapshotRows) {
    if (!latestSnapshotByProperty.has(s.propertyId)) {
      latestSnapshotByProperty.set(s.propertyId, {
        estimatedMarketValueCents: s.estimatedMarketValueCents,
        isListed: s.isListed,
        isListedDate: s.isListedDate,
        fetchedAt: s.fetchedAt,
      });
    }
  }

  const buyerRows = contractIds.length
    ? await db
        .select({ contractId: contractParties.contractId, displayName: parties.displayName, email: parties.email, phone: parties.phone })
        .from(contractParties)
        .innerJoin(parties, eq(contractParties.partyId, parties.id))
        .where(and(inArray(contractParties.contractId, contractIds), eq(contractParties.role, "BUYER")))
    : [];
  const buyerNamesByContract = new Map<string, string[]>();
  const buyerContactByContract = new Map<string, { email: string | null; phone: string | null }>();
  for (const b of buyerRows) {
    const list = buyerNamesByContract.get(b.contractId) ?? [];
    list.push(b.displayName);
    buyerNamesByContract.set(b.contractId, list);
    if (!buyerContactByContract.has(b.contractId)) {
      buyerContactByContract.set(b.contractId, { email: b.email, phone: b.phone });
    }
  }

  // Current lender(s) only — a split-funded contract can have more than
  // one, same "active funding" filter every other page uses.
  const lenderRows = contractIds.length
    ? await db
        .select({ contractId: contractParties.contractId, displayName: parties.displayName })
        .from(contractParties)
        .innerJoin(parties, eq(contractParties.partyId, parties.id))
        .where(
          and(
            inArray(contractParties.contractId, contractIds),
            eq(contractParties.role, "INVESTOR_PAYEE"),
            gt(contractParties.ownershipPercent, "0"),
            isNull(contractParties.endDate)
          )
        )
    : [];
  const lenderNamesByContract = new Map<string, string[]>();
  for (const l of lenderRows) {
    const list = lenderNamesByContract.get(l.contractId) ?? [];
    list.push(l.displayName);
    lenderNamesByContract.set(l.contractId, list);
  }

  return contractRows.map((c) => {
    const property = c.propertyId ? propertyById.get(c.propertyId) : undefined;
    const contact = buyerContactByContract.get(c.id);
    return {
      contractId: c.id,
      contractNumber: c.contractNumber,
      loanType: c.loanType,
      borrowerName: (buyerNamesByContract.get(c.id) ?? []).join(" & ") || null,
      borrowerEmail: contact?.email ?? null,
      borrowerPhone: contact?.phone ?? null,
      lenderName: (lenderNamesByContract.get(c.id) ?? []).join(", ") || null,
      propertyAddress: property ? `${property.streetAddress}, ${property.city}, ${property.state} ${property.zip}` : "—",
      county: property?.county ?? "—",
      currentPrincipalBalanceCents: c.currentPrincipalBalanceCents,
      snapshot: (c.propertyId ? latestSnapshotByProperty.get(c.propertyId) : undefined) ?? null,
    };
  });
}

export interface EquityAnalysisRow {
  contractId: string;
  contractNumber: string;
  lenderName: string | null;
  borrowerName: string | null;
  borrowerEmail: string | null;
  borrowerPhone: string | null;
  propertyAddress: string;
  county: string;
  currentPrincipalBalanceCents: number;
  estimatedMarketValueCents: number | null;
  equityCents: number | null;
  equityPercent: number | null;
  assessorFetchedAt: string | null;
  qualifies: boolean;
}

export const DEFAULT_EQUITY_THRESHOLD_PERCENT = 20;

// Compares each active Land Contract's outstanding balance to the
// property's AssessorSearch-estimated market value — a refi-marketing
// candidate list for LC holders with enough estimated equity to likely
// qualify for a conventional refinance. Scoped to LAND_CONTRACT only:
// 1st/2nd lien/unsecured loans aren't structured as a land contract, so the
// same "convert to a mortgage" pitch doesn't apply to them. Equity % is
// computed against OUR OWN balance, not AssessorSearch's own
// estimated_equity/estimated_ltv fields — those assume a different
// (usually wrong) loan balance, since AssessorSearch has no idea what this
// specific land contract's actual balance is. `thresholdPercent` is staff-
// adjustable on the report itself rather than fixed, since what counts as
// "worth marketing" is a business call, not a constant.
export async function getEquityAnalysis(thresholdPercent: number = DEFAULT_EQUITY_THRESHOLD_PERCENT): Promise<EquityAnalysisRow[]> {
  const base = await getActiveContractsWithAssessorData("LAND_CONTRACT");

  return base
    .map((b) => {
      const marketValueCents = b.snapshot?.estimatedMarketValueCents ?? null;
      const equityCents = marketValueCents !== null ? marketValueCents - b.currentPrincipalBalanceCents : null;
      const equityPercent = marketValueCents !== null && marketValueCents > 0 ? ((equityCents as number) / marketValueCents) * 100 : null;

      return {
        contractId: b.contractId,
        contractNumber: b.contractNumber,
        lenderName: b.lenderName,
        borrowerName: b.borrowerName,
        borrowerEmail: b.borrowerEmail,
        borrowerPhone: b.borrowerPhone,
        propertyAddress: b.propertyAddress,
        county: b.county,
        currentPrincipalBalanceCents: b.currentPrincipalBalanceCents,
        estimatedMarketValueCents: marketValueCents,
        equityCents,
        equityPercent,
        assessorFetchedAt: b.snapshot?.fetchedAt.toISOString() ?? null,
        qualifies: equityPercent !== null && equityPercent >= thresholdPercent,
      };
    })
    .sort((a, b) => {
      if (a.equityPercent === null) return 1;
      if (b.equityPercent === null) return -1;
      return b.equityPercent - a.equityPercent;
    });
}

export function renderEquityAnalysisHtml(rows: EquityAnalysisRow[], thresholdPercent: number = DEFAULT_EQUITY_THRESHOLD_PERCENT): string {
  const fmt = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const body = rows
    .map(
      (r) => `<tr>
        <td>${r.contractNumber}</td>
        <td>${r.lenderName ?? "—"}</td>
        <td>${r.borrowerName ?? "—"}</td>
        <td>${r.borrowerEmail ?? "—"}</td>
        <td>${r.borrowerPhone ?? "—"}</td>
        <td>${r.propertyAddress}</td>
        <td>${fmt(r.currentPrincipalBalanceCents)}</td>
        <td>${r.estimatedMarketValueCents !== null ? fmt(r.estimatedMarketValueCents) : "—"}</td>
        <td>${r.equityPercent !== null ? r.equityPercent.toFixed(1) + "%" : "—"}</td>
        <td>${r.qualifies ? "Yes" : "No"}</td>
      </tr>`
    )
    .join("");

  return `
    <h2>Land Contract Equity Analysis</h2>
    <p>Land Contract balance vs. AssessorSearch estimated market value. Qualifies = ${thresholdPercent}%+ estimated equity.</p>
    <table cellpadding="4" style="border-collapse:collapse;width:100%">
      <thead><tr><th>Contract #</th><th>Lender</th><th>Borrower</th><th>Email</th><th>Phone</th><th>Property</th><th>LC Balance</th><th>Market Value</th><th>Equity %</th><th>Qualifies</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

export interface ListedPropertyRow {
  contractId: string;
  contractNumber: string;
  loanType: (typeof loanTypeEnum.enumValues)[number];
  lenderName: string | null;
  borrowerName: string | null;
  propertyAddress: string;
  county: string;
  currentPrincipalBalanceCents: number;
  isListedDate: string | null;
  assessorFetchedAt: string;
}

// Sweeps every active contract's latest AssessorSearch snapshot for
// is_listed = true — a signal the collateral property may be about to
// sell/payoff regardless of loan type, so unlike the equity report this
// isn't restricted to Land Contracts.
export async function getListedForSaleProperties(): Promise<ListedPropertyRow[]> {
  const base = await getActiveContractsWithAssessorData();

  return base
    .filter((b) => b.snapshot?.isListed === true)
    .map((b) => ({
      contractId: b.contractId,
      contractNumber: b.contractNumber,
      loanType: b.loanType,
      lenderName: b.lenderName,
      borrowerName: b.borrowerName,
      propertyAddress: b.propertyAddress,
      county: b.county,
      currentPrincipalBalanceCents: b.currentPrincipalBalanceCents,
      isListedDate: b.snapshot!.isListedDate,
      assessorFetchedAt: b.snapshot!.fetchedAt.toISOString(),
    }))
    .sort((a, b) => (b.isListedDate ?? "").localeCompare(a.isListedDate ?? ""));
}

export function renderListedForSaleHtml(rows: ListedPropertyRow[]): string {
  const fmt = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const body = rows
    .map(
      (r) => `<tr>
        <td>${r.contractNumber}</td>
        <td>${LOAN_TYPE_LABELS[r.loanType] ?? r.loanType}</td>
        <td>${r.lenderName ?? "—"}</td>
        <td>${r.borrowerName ?? "—"}</td>
        <td>${r.propertyAddress}</td>
        <td>${fmt(r.currentPrincipalBalanceCents)}</td>
        <td>${r.isListedDate ?? "—"}</td>
      </tr>`
    )
    .join("");

  return `
    <h2>Properties Listed For Sale</h2>
    <p>Active contracts whose collateral property is currently listed for sale, per AssessorSearch.</p>
    <table cellpadding="4" style="border-collapse:collapse;width:100%">
      <thead><tr><th>Contract #</th><th>Loan Type</th><th>Lender</th><th>Borrower</th><th>Property</th><th>Balance</th><th>Listed Date</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  `;
}
