import { and, eq, gte, lte, sum } from "drizzle-orm";
import { db } from "@/db/client";
import { lenderLedgerEntries } from "@/db/schema/lending";
import { parties } from "@/db/schema/parties";
import { payments, paymentAllocations } from "@/db/schema/payments";
import { contracts, contractParties } from "@/db/schema/contracts";
import { formatCents } from "@/lib/format";

// These are internal WORKSHEETS for preparing real 1099-INT/1098 filings —
// not the official IRS forms themselves (box layout, print positioning for
// pre-printed forms, e-filing, etc. are all out of scope). Numbers here are
// what belongs in Box 1 of each; staff key them into actual filing software.
// Filing thresholds are shown as a flag, not a hide — a lender/borrower
// under threshold still gets listed so nothing silently disappears.

const FORM_1099_INT_THRESHOLD_CENTS = 1000; // $10
const FORM_1098_THRESHOLD_CENTS = 60000; // $600

function yearBounds(taxYear: number): { start: string; end: string } {
  return { start: `${taxYear}-01-01`, end: `${taxYear}-12-31` };
}

export interface Lender1099Row {
  lenderId: string;
  displayName: string;
  totalInterestCents: number;
  meetsThreshold: boolean;
}

// Interest actually credited to the lender (interestCents — their
// ownership-weighted share, already stored as an immutable snapshot on
// PAYMENT_CREDIT rows) — never principal, never the servicing fee, and
// never late fees (those are lender revenue too, but not "interest" for
// 1099-INT purposes).
export async function getLender1099Data(taxYear: number): Promise<Lender1099Row[]> {
  const { start, end } = yearBounds(taxYear);

  const rows = await db
    .select({
      lenderId: lenderLedgerEntries.lenderPartyId,
      displayName: parties.displayName,
      total: sum(lenderLedgerEntries.interestCents),
    })
    .from(lenderLedgerEntries)
    .innerJoin(parties, eq(lenderLedgerEntries.lenderPartyId, parties.id))
    .where(
      and(
        eq(lenderLedgerEntries.entryType, "PAYMENT_CREDIT"),
        gte(lenderLedgerEntries.transactionDate, start),
        lte(lenderLedgerEntries.transactionDate, end)
      )
    )
    .groupBy(lenderLedgerEntries.lenderPartyId, parties.displayName)
    .orderBy(parties.displayName);

  return rows
    .map((r) => ({
      lenderId: r.lenderId,
      displayName: r.displayName,
      totalInterestCents: Number(r.total ?? 0),
      meetsThreshold: Number(r.total ?? 0) >= FORM_1099_INT_THRESHOLD_CENTS,
    }))
    .filter((r) => r.totalInterestCents > 0);
}

export function renderLender1099Html(rows: Lender1099Row[], taxYear: number): string {
  const body = rows
    .map(
      (r) =>
        `<tr><td>${r.displayName}</td><td style="text-align:right">${formatCents(r.totalInterestCents)}</td><td>${r.meetsThreshold ? "" : "Below $10 threshold"}</td></tr>`
    )
    .join("");

  return `
    <h2>1099-INT Worksheet — Tax Year ${taxYear}</h2>
    <p style="font-size:0.85em;color:#666">Box 1 (Interest Income) amounts for preparing real 1099-INT filings — not
    the official IRS form. The IRS only requires filing a 1099-INT for $10+ in interest paid. Historical (pre-this-app)
    lender credits never stored a structured interest figure, so tax years before go-live will be incomplete, not
    zero-interest.</p>
    <table cellpadding="4" style="border-collapse:collapse;width:100%">
      <thead><tr><th>Lender</th><th>Interest Paid (Box 1)</th><th></th></tr></thead>
      <tbody>${body || '<tr><td colspan="3">No lender interest activity in this tax year.</td></tr>'}</tbody>
    </table>
  `;
}

export interface Borrower1098Row {
  contractId: string;
  contractNumber: string;
  borrowerName: string;
  totalInterestCents: number;
  meetsThreshold: boolean;
}

// Mortgage interest actually received from the borrower (paymentAllocations
// INTEREST, cleared payments only) — grouped by contract (Form 1098 is
// issued per loan), not by borrower party, matching how every other
// borrower report in this app selects.
export async function getBorrower1098Data(taxYear: number): Promise<Borrower1098Row[]> {
  const { start, end } = yearBounds(taxYear);

  const rows = await db
    .select({
      contractId: contracts.id,
      contractNumber: contracts.contractNumber,
      borrowerName: parties.displayName,
      total: sum(paymentAllocations.amountCents),
    })
    .from(paymentAllocations)
    .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
    .innerJoin(contracts, eq(payments.contractId, contracts.id))
    .innerJoin(contractParties, and(eq(contractParties.contractId, contracts.id), eq(contractParties.role, "BUYER")))
    .innerJoin(parties, eq(contractParties.partyId, parties.id))
    .where(
      and(
        eq(paymentAllocations.allocationType, "INTEREST"),
        eq(payments.status, "CLEARED"),
        gte(payments.receivedDate, start),
        lte(payments.receivedDate, end)
      )
    )
    .groupBy(contracts.id, contracts.contractNumber, parties.displayName)
    .orderBy(parties.displayName);

  return rows
    .map((r) => ({
      contractId: r.contractId,
      contractNumber: r.contractNumber,
      borrowerName: r.borrowerName,
      totalInterestCents: Number(r.total ?? 0),
      meetsThreshold: Number(r.total ?? 0) >= FORM_1098_THRESHOLD_CENTS,
    }))
    .filter((r) => r.totalInterestCents > 0);
}

export function renderBorrower1098Html(rows: Borrower1098Row[], taxYear: number): string {
  const body = rows
    .map(
      (r) =>
        `<tr><td>${r.borrowerName}</td><td>${r.contractNumber}</td><td style="text-align:right">${formatCents(r.totalInterestCents)}</td><td>${r.meetsThreshold ? "" : "Below $600 threshold"}</td></tr>`
    )
    .join("");

  return `
    <h2>1098 Worksheet — Tax Year ${taxYear}</h2>
    <p style="font-size:0.85em;color:#666">Box 1 (Mortgage Interest Received) amounts for preparing real 1098
    filings — not the official IRS form. The IRS only requires filing a 1098 for $600+ in interest received.</p>
    <table cellpadding="4" style="border-collapse:collapse;width:100%">
      <thead><tr><th>Borrower</th><th>Land Contract</th><th>Interest Received (Box 1)</th><th></th></tr></thead>
      <tbody>${body || '<tr><td colspan="4">No borrower interest activity in this tax year.</td></tr>'}</tbody>
    </table>
  `;
}
