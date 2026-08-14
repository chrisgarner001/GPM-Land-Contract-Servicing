import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts, contractParties } from "@/db/schema/contracts";
import { parties, properties } from "@/db/schema/parties";
import { payments } from "@/db/schema/payments";
import { generatedDocuments, type documentTypeEnum } from "@/db/schema/documents";

export interface ContractOption {
  id: string;
  contractNumber: string;
  buyerName: string | null;
  // Joined display string — a split-funded contract can have more than one
  // current lender; null when the contract has no active funding on record.
  lenderName: string | null;
}

// Active contracts only — a paid-off/defaulted/cancelled/foreclosed
// contract's lender no longer holds a real assignable interest in it, so it
// has no business showing up as something to generate a deed/assignment
// for. Sorted by lender first (then contract number) since staff typically
// work a batch of assignments one lender at a time.
export async function getContractOptionsForDocuments(): Promise<ContractOption[]> {
  const rows = await db
    .select({ id: contracts.id, contractNumber: contracts.contractNumber })
    .from(contracts)
    .where(eq(contracts.status, "ACTIVE"))
    .orderBy(contracts.contractNumber);

  const buyerRows = await db
    .select({ contractId: contractParties.contractId, buyerName: parties.displayName })
    .from(contractParties)
    .innerJoin(parties, eq(contractParties.partyId, parties.id))
    .where(eq(contractParties.role, "BUYER"));
  const buyerByContract = new Map(buyerRows.map((r) => [r.contractId, r.buyerName]));

  const lenderRows = await db
    .select({ contractId: contractParties.contractId, lenderName: parties.displayName })
    .from(contractParties)
    .innerJoin(parties, eq(contractParties.partyId, parties.id))
    .where(
      and(eq(contractParties.role, "INVESTOR_PAYEE"), gt(contractParties.ownershipPercent, "0"), isNull(contractParties.endDate))
    );
  const lenderNamesByContract = new Map<string, string[]>();
  for (const r of lenderRows) {
    const list = lenderNamesByContract.get(r.contractId) ?? [];
    list.push(r.lenderName);
    lenderNamesByContract.set(r.contractId, list);
  }

  const options = rows.map((r) => ({
    id: r.id,
    contractNumber: r.contractNumber,
    buyerName: buyerByContract.get(r.id) ?? null,
    lenderName: (lenderNamesByContract.get(r.id) ?? []).join(", ") || null,
  }));

  return options.sort((a, b) => {
    const lenderCmp = (a.lenderName ?? "").localeCompare(b.lenderName ?? "");
    return lenderCmp !== 0 ? lenderCmp : a.contractNumber.localeCompare(b.contractNumber);
  });
}

export interface PartyContact {
  displayName: string;
  fullAddress: string;
}

function joinAddress(line1: string | null, city: string | null, state: string | null, zip: string | null): string {
  const cityStateZip = [city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [line1, cityStateZip].filter(Boolean).join(", ");
}

export interface DeedPrefillData {
  contractNumber: string;
  // Raw ISO date (yyyy-mm-dd) — the form's date inputs are type="date" and
  // convert to the deed's "Month D, YYYY" display format at generate time,
  // same as every other date field in this form.
  originationDate: string | null;
  // The original land contract sale price — what a payoff Warranty Deed's
  // transfer tax/consideration is based on (the total value conveyed over
  // the life of the contract), NOT the current outstanding balance.
  purchasePriceCents: number;
  currentPrincipalBalanceCents: number;
  interestRateAnnual: string;
  county: string | null;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  parcelNumber: string | null;
  legalDescription: string | null;
  buyer: PartyContact | null;
  // A split-funded contract can have more than one current lender — every
  // one is returned so the form can offer a choice; the UI defaults to the
  // first for prefill, same as everywhere else in the app treats "the"
  // current lender for display purposes.
  currentLenders: PartyContact[];
  // Raw ISO date — the most recent CLEARED, non-held, non-reversed payment's
  // receivedDate, used as a proxy for the LC Seller's Assignment's "Interest
  // Paid Through" field (no dedicated paid-through-date column exists).
  lastPaymentDate: string | null;
}

// Reuses the exact same joins ContractLayout's getHeaderData() and
// page.tsx's getBuyerContact() already use — no new query shape invented.
export async function getDeedPrefillData(contractId: string): Promise<DeedPrefillData | null> {
  const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!contract) return null;

  const [property] = contract.propertyId
    ? await db.select().from(properties).where(eq(properties.id, contract.propertyId))
    : [];

  const [buyerRow] = await db
    .select({
      displayName: parties.displayName,
      mailingAddressLine1: parties.mailingAddressLine1,
      mailingCity: parties.mailingCity,
      mailingState: parties.mailingState,
      mailingZip: parties.mailingZip,
    })
    .from(contractParties)
    .innerJoin(parties, eq(contractParties.partyId, parties.id))
    .where(and(eq(contractParties.contractId, contractId), eq(contractParties.role, "BUYER")));

  const lenderRows = await db
    .select({
      displayName: parties.displayName,
      mailingAddressLine1: parties.mailingAddressLine1,
      mailingCity: parties.mailingCity,
      mailingState: parties.mailingState,
      mailingZip: parties.mailingZip,
    })
    .from(contractParties)
    .innerJoin(parties, eq(contractParties.partyId, parties.id))
    .where(
      and(
        eq(contractParties.contractId, contractId),
        eq(contractParties.role, "INVESTOR_PAYEE"),
        gt(contractParties.ownershipPercent, "0"),
        isNull(contractParties.endDate)
      )
    );

  const [lastPayment] = await db
    .select({ receivedDate: payments.receivedDate })
    .from(payments)
    .where(
      and(
        eq(payments.contractId, contractId),
        eq(payments.status, "CLEARED"),
        isNull(payments.reversedPaymentId)
      )
    )
    .orderBy(desc(payments.receivedDate), desc(payments.createdAt))
    .limit(1);

  return {
    contractNumber: contract.contractNumber,
    originationDate: contract.originationDate,
    purchasePriceCents: contract.purchasePriceCents,
    currentPrincipalBalanceCents: contract.currentPrincipalBalanceCents,
    interestRateAnnual: contract.interestRateAnnual,
    county: property?.county ?? null,
    streetAddress: property?.streetAddress ?? null,
    city: property?.city ?? null,
    state: property?.state ?? null,
    parcelNumber: property?.parcelNumber ?? null,
    legalDescription: property?.legalDescription ?? null,
    buyer: buyerRow
      ? {
          displayName: buyerRow.displayName,
          fullAddress: joinAddress(buyerRow.mailingAddressLine1, buyerRow.mailingCity, buyerRow.mailingState, buyerRow.mailingZip),
        }
      : null,
    currentLenders: lenderRows.map((l) => ({
      displayName: l.displayName,
      fullAddress: joinAddress(l.mailingAddressLine1, l.mailingCity, l.mailingState, l.mailingZip),
    })),
    lastPaymentDate: lastPayment?.receivedDate ?? null,
  };
}

export interface LogGeneratedDocumentInput {
  contractId: string | null;
  docType: (typeof documentTypeEnum.enumValues)[number];
  grantorName: string | null;
  granteeName: string | null;
  propertyAddress: string | null;
  dataSnapshot: string;
  generatedBy: string | null;
}

export async function logGeneratedDocument(input: LogGeneratedDocumentInput): Promise<void> {
  await db.insert(generatedDocuments).values(input);
}
