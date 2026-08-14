import Decimal from "decimal.js";
import { and, eq, gt, gte, lte, isNull, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { parties } from "@/db/schema/parties";
import { contracts, contractParties } from "@/db/schema/contracts";
import { lenderLedgerEntries } from "@/db/schema/lending";
import { contractCharges } from "@/db/schema/charges";
import { checks, checkLineItems } from "@/db/schema/checks";
import { regressNextPaymentDate } from "@/domain/ledger/advanceNextPaymentDate";
import { annualRateToDailyDecimal365 } from "@/domain/money";
import { formatCents, formatDate, formatPercent } from "@/lib/format";

export interface LenderOption {
  id: string;
  displayName: string;
}

export async function getLenderOptions(): Promise<LenderOption[]> {
  return db
    .selectDistinct({ id: parties.id, displayName: parties.displayName })
    .from(parties)
    .innerJoin(contractParties, and(eq(contractParties.partyId, parties.id), eq(contractParties.role, "INVESTOR_PAYEE")))
    .orderBy(parties.displayName);
}

// ---------------------------------------------------------------------------
// Accrued Interest — a live projection (not stored anywhere): per-diem
// (principal x daily actual/365 rate x ownership%) x days since the later of
// the lender's last paid-through due date or the range start, through the
// range end. Same per-diem convention calculatePayoffQuote already uses for
// borrower payoff quotes, applied here per lender holding instead.
// ---------------------------------------------------------------------------
export interface AccruedInterestHolding {
  contractId: string;
  contractNumber: string;
  borrowerName: string;
  ownershipPercent: string;
  interestRateAnnual: string;
  principalBalanceCents: number;
  accrualStartDate: string;
  days: number;
  accruedInterestCents: number;
}

export interface AccruedInterestData {
  lenderId: string;
  holdings: AccruedInterestHolding[];
  totalAccruedInterestCents: number;
}

export async function getAccruedInterestData(lenderIds: string[], startDate: string, endDate: string): Promise<AccruedInterestData[]> {
  if (lenderIds.length === 0) return [];

  const holdingRows = await db
    .select({
      lenderId: contractParties.partyId,
      contractId: contracts.id,
      contractNumber: contracts.contractNumber,
      ownershipPercent: contractParties.ownershipPercent,
      interestRateAnnual: contracts.interestRateAnnual,
      currentPrincipalBalanceCents: contracts.currentPrincipalBalanceCents,
      nextPaymentDate: contracts.nextPaymentDate,
      paymentFrequency: contracts.paymentFrequency,
    })
    .from(contractParties)
    .innerJoin(contracts, eq(contractParties.contractId, contracts.id))
    .where(
      and(
        inArray(contractParties.partyId, lenderIds),
        eq(contractParties.role, "INVESTOR_PAYEE"),
        gt(contractParties.ownershipPercent, "0"),
        isNull(contractParties.endDate)
      )
    )
    .orderBy(contracts.contractNumber);

  const contractIds = [...new Set(holdingRows.map((r) => r.contractId))];
  const borrowerRows =
    contractIds.length > 0
      ? await db
          .select({ contractId: contractParties.contractId, displayName: parties.displayName })
          .from(contractParties)
          .innerJoin(parties, eq(contractParties.partyId, parties.id))
          .where(and(inArray(contractParties.contractId, contractIds), eq(contractParties.role, "BUYER")))
      : [];
  const borrowerByContract = new Map<string, string>();
  for (const b of borrowerRows) {
    if (!borrowerByContract.has(b.contractId)) borrowerByContract.set(b.contractId, b.displayName);
  }

  return lenderIds.map((lenderId) => {
    const holdings: AccruedInterestHolding[] = holdingRows
      .filter((r) => r.lenderId === lenderId)
      .map((r) => {
        // No due date on file — nothing to accrue against.
        if (!r.nextPaymentDate) {
          return {
            contractId: r.contractId,
            contractNumber: r.contractNumber,
            borrowerName: borrowerByContract.get(r.contractId) ?? "—",
            ownershipPercent: r.ownershipPercent ?? "0",
            interestRateAnnual: r.interestRateAnnual,
            principalBalanceCents: r.currentPrincipalBalanceCents,
            accrualStartDate: startDate,
            days: 0,
            accruedInterestCents: 0,
          };
        }
        const lastDueDate = regressNextPaymentDate(r.nextPaymentDate, r.paymentFrequency);
        const accrualStartDate = lastDueDate > startDate ? lastDueDate : startDate;

        const start = new Date(`${accrualStartDate}T00:00:00Z`);
        const end = new Date(`${endDate}T00:00:00Z`);
        const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);

        const dailyRate = annualRateToDailyDecimal365(Number(r.interestRateAnnual));
        const ownershipShare = new Decimal(r.ownershipPercent ?? "0").dividedBy(100);
        const accruedInterestCents = new Decimal(r.currentPrincipalBalanceCents)
          .mul(dailyRate)
          .mul(days)
          .mul(ownershipShare)
          .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
          .toNumber();

        return {
          contractId: r.contractId,
          contractNumber: r.contractNumber,
          borrowerName: borrowerByContract.get(r.contractId) ?? "—",
          ownershipPercent: r.ownershipPercent ?? "0",
          interestRateAnnual: r.interestRateAnnual,
          principalBalanceCents: r.currentPrincipalBalanceCents,
          accrualStartDate,
          days,
          accruedInterestCents,
        };
      });

    return {
      lenderId,
      holdings,
      totalAccruedInterestCents: holdings.reduce((s, h) => s + h.accruedInterestCents, 0),
    };
  });
}

export function renderAccruedInterestHtml(lenderName: string, data: AccruedInterestData, startDate: string, endDate: string): string {
  const rows = data.holdings
    .map(
      (h) =>
        `<tr><td>${h.contractNumber}</td><td>${h.borrowerName}</td><td style="text-align:right">${formatPercent(h.ownershipPercent)}</td><td style="text-align:right">${formatPercent(h.interestRateAnnual)}</td><td style="text-align:right">${formatCents(h.principalBalanceCents)}</td><td style="text-align:right">${h.days}</td><td style="text-align:right">${formatCents(h.accruedInterestCents)}</td></tr>`
    )
    .join("");

  return `
    <h2>Accrued Interest — ${lenderName}</h2>
    <p>${formatDate(startDate)} – ${formatDate(endDate)}</p>
    <table cellpadding="4" style="border-collapse:collapse;width:100%">
      <thead><tr><th>Land Contract</th><th>Borrower</th><th>Ownership %</th><th>Rate</th><th>Principal Balance</th><th>Days</th><th>Accrued Interest</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7">No active holdings.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="6">Total</td><td style="text-align:right">${formatCents(data.totalAccruedInterestCents)}</td></tr></tfoot>
    </table>
    <p style="font-size:0.85em;color:#666">Interest accrued since the last serviced due date but not yet distributed — a projection as of ${formatDate(endDate)}, not a stored/paid figure.</p>
  `;
}

// ---------------------------------------------------------------------------
// Portfolio Change in Principal — sums lender_ledger_entries.principalCents
// (PAYMENT_CREDIT only), which is already the exact ownership-weighted
// principal credited to this lender per payment, stored immutably at credit
// time. Not re-derived from payment_allocations.
// ---------------------------------------------------------------------------
export interface PrincipalChangeRow {
  contractId: string;
  contractNumber: string;
  principalChangeCents: number;
}

export interface PrincipalChangeData {
  lenderId: string;
  rows: PrincipalChangeRow[];
  totalPrincipalChangeCents: number;
}

export async function getPrincipalChangeData(lenderIds: string[], startDate: string, endDate: string): Promise<PrincipalChangeData[]> {
  if (lenderIds.length === 0) return [];

  const creditRows = await db
    .select({
      lenderId: lenderLedgerEntries.lenderPartyId,
      contractId: lenderLedgerEntries.sourceContractId,
      contractNumber: contracts.contractNumber,
      principalCents: lenderLedgerEntries.principalCents,
    })
    .from(lenderLedgerEntries)
    .leftJoin(contracts, eq(lenderLedgerEntries.sourceContractId, contracts.id))
    .where(
      and(
        inArray(lenderLedgerEntries.lenderPartyId, lenderIds),
        eq(lenderLedgerEntries.entryType, "PAYMENT_CREDIT"),
        gte(lenderLedgerEntries.transactionDate, startDate),
        lte(lenderLedgerEntries.transactionDate, endDate)
      )
    );

  return lenderIds.map((lenderId) => {
    const byContract = new Map<string, PrincipalChangeRow>();
    for (const r of creditRows) {
      if (r.lenderId !== lenderId || !r.contractId) continue;
      const existing = byContract.get(r.contractId);
      const amount = r.principalCents ?? 0;
      if (existing) existing.principalChangeCents += amount;
      else byContract.set(r.contractId, { contractId: r.contractId, contractNumber: r.contractNumber ?? "—", principalChangeCents: amount });
    }
    const rows = [...byContract.values()].sort((a, b) => a.contractNumber.localeCompare(b.contractNumber));
    return { lenderId, rows, totalPrincipalChangeCents: rows.reduce((s, r) => s + r.principalChangeCents, 0) };
  });
}

export function renderPrincipalChangeHtml(lenderName: string, data: PrincipalChangeData, startDate: string, endDate: string): string {
  const rows = data.rows
    .map((r) => `<tr><td>${r.contractNumber}</td><td style="text-align:right">${formatCents(r.principalChangeCents)}</td></tr>`)
    .join("");

  return `
    <h2>Portfolio Change in Principal — ${lenderName}</h2>
    <p>${formatDate(startDate)} – ${formatDate(endDate)}</p>
    <table cellpadding="4" style="border-collapse:collapse;width:100%">
      <thead><tr><th>Land Contract</th><th>Principal Change</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="2">No principal credited in this range.</td></tr>'}</tbody>
      <tfoot><tr><td>Total</td><td style="text-align:right">${formatCents(data.totalPrincipalChangeCents)}</td></tr></tfoot>
    </table>
  `;
}

// ---------------------------------------------------------------------------
// Portfolio Charges — CHARGE_DEBIT rows come from exactly one place
// (createVendorInvoice's CHARGE_LENDER mode), which in the same transaction
// also inserts a contract_charges row for the borrower. There's no shared id
// between the two tables, so "also charged to borrower" is matched on
// (contractId, chargeDate = transactionDate) — the best correlation the
// schema supports, not a guarantee for older/imported rows.
// ---------------------------------------------------------------------------
export interface PortfolioChargeRow {
  contractId: string | null;
  contractNumber: string | null;
  transactionDate: string;
  description: string | null;
  amountPaidOutCents: number;
  alsoChargedToBorrower: boolean;
  borrowerRemainingCents: number | null;
}

export interface PortfolioChargesData {
  lenderId: string;
  rows: PortfolioChargeRow[];
  totalChargesCents: number;
}

export async function getPortfolioChargesData(lenderIds: string[], startDate: string, endDate: string): Promise<PortfolioChargesData[]> {
  if (lenderIds.length === 0) return [];

  const chargeRows = await db
    .select({
      lenderId: lenderLedgerEntries.lenderPartyId,
      contractId: lenderLedgerEntries.sourceContractId,
      contractNumber: contracts.contractNumber,
      transactionDate: lenderLedgerEntries.transactionDate,
      description: lenderLedgerEntries.description,
      amountPaidOutCents: lenderLedgerEntries.amountPaidOutCents,
    })
    .from(lenderLedgerEntries)
    .leftJoin(contracts, eq(lenderLedgerEntries.sourceContractId, contracts.id))
    .where(
      and(
        inArray(lenderLedgerEntries.lenderPartyId, lenderIds),
        eq(lenderLedgerEntries.entryType, "CHARGE_DEBIT"),
        gte(lenderLedgerEntries.transactionDate, startDate),
        lte(lenderLedgerEntries.transactionDate, endDate)
      )
    );

  const contractIds = [...new Set(chargeRows.map((r) => r.contractId).filter((id): id is string => id !== null))];
  const borrowerCharges =
    contractIds.length > 0
      ? await db
          .select({ contractId: contractCharges.contractId, chargeDate: contractCharges.chargeDate, remainingCents: contractCharges.remainingCents })
          .from(contractCharges)
          .where(inArray(contractCharges.contractId, contractIds))
      : [];

  function findBorrowerCharge(contractId: string | null, transactionDate: string) {
    if (!contractId) return null;
    return borrowerCharges.find((c) => c.contractId === contractId && c.chargeDate === transactionDate) ?? null;
  }

  return lenderIds.map((lenderId) => {
    const rows: PortfolioChargeRow[] = chargeRows
      .filter((r) => r.lenderId === lenderId)
      .map((r) => {
        const match = findBorrowerCharge(r.contractId, r.transactionDate);
        return {
          contractId: r.contractId,
          contractNumber: r.contractNumber,
          transactionDate: r.transactionDate,
          description: r.description,
          amountPaidOutCents: r.amountPaidOutCents ?? 0,
          alsoChargedToBorrower: match !== null,
          borrowerRemainingCents: match?.remainingCents ?? null,
        };
      });
    return { lenderId, rows, totalChargesCents: rows.reduce((s, r) => s + r.amountPaidOutCents, 0) };
  });
}

export function renderPortfolioChargesHtml(lenderName: string, data: PortfolioChargesData, startDate: string, endDate: string): string {
  const rows = data.rows
    .map(
      (r) =>
        `<tr><td>${formatDate(r.transactionDate)}</td><td>${r.contractNumber ?? "—"}</td><td>${r.description ?? "—"}</td><td style="text-align:right">${formatCents(r.amountPaidOutCents)}</td><td>${r.alsoChargedToBorrower ? `Yes (${formatCents(r.borrowerRemainingCents)} remaining)` : "No"}</td></tr>`
    )
    .join("");

  return `
    <h2>Portfolio Charges — ${lenderName}</h2>
    <p>${formatDate(startDate)} – ${formatDate(endDate)}</p>
    <table cellpadding="4" style="border-collapse:collapse;width:100%">
      <thead><tr><th>Date</th><th>Land Contract</th><th>Description</th><th>Amount</th><th>Also Charged to Borrower</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">No charges in this range.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="3">Total</td><td style="text-align:right">${formatCents(data.totalChargesCents)}</td><td></td></tr></tfoot>
    </table>
  `;
}

// ---------------------------------------------------------------------------
// Name & Address Listing
// ---------------------------------------------------------------------------
export interface LenderNameAddressRow {
  displayName: string;
  phone: string | null;
  mailingAddressLine1: string | null;
  mailingCity: string | null;
  mailingState: string | null;
  mailingZip: string | null;
}

export async function getLenderNameAddressListing(): Promise<LenderNameAddressRow[]> {
  return db
    .selectDistinct({
      displayName: parties.displayName,
      phone: parties.phone,
      mailingAddressLine1: parties.mailingAddressLine1,
      mailingCity: parties.mailingCity,
      mailingState: parties.mailingState,
      mailingZip: parties.mailingZip,
    })
    .from(parties)
    .innerJoin(
      contractParties,
      and(eq(contractParties.partyId, parties.id), eq(contractParties.role, "INVESTOR_PAYEE"), gt(contractParties.ownershipPercent, "0"))
    )
    .orderBy(parties.displayName);
}

export function renderLenderNameAddressListingHtml(rows: LenderNameAddressRow[]): string {
  const body = rows
    .map(
      (r) =>
        `<tr><td>${r.displayName}</td><td>${r.phone ?? "—"}</td><td>${[r.mailingAddressLine1, r.mailingCity, r.mailingState, r.mailingZip].filter(Boolean).join(", ") || "—"}</td></tr>`
    )
    .join("");

  return `
    <h2>Lender Name &amp; Address Listing</h2>
    <table cellpadding="4" style="border-collapse:collapse;width:100%">
      <thead><tr><th>Name</th><th>Phone</th><th>Mailing Address</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

// ---------------------------------------------------------------------------
// ACH Payments — lender distributions run with ACH selected on the Lender
// Payment Run screen. Reuses checks/checkLineItems directly (the same
// immutable record that screen creates), matched to a lender by payeeName
// (checks has no FK to parties — see checks.ts schema comment; ACH/Check
// distributions always set payeeName = the lender's own displayName, the
// same convention isLenderPayeeSql relies on). Late Charges are the
// lender's own money and already part of the check's totalAmountCents;
// Other Charges are informational context only, never part of it — see
// LenderPaymentRunLineItem.
// ---------------------------------------------------------------------------
export interface AchPaymentContractLine {
  contractId: string | null;
  contractNumber: string | null;
  amountCents: number;
  interestCents: number;
  principalCents: number;
  lateChargesCents: number;
  otherChargesCents: number;
}

export interface AchPaymentCheck {
  checkId: string;
  checkNumber: string;
  checkDate: string;
  totalAmountCents: number;
  lines: AchPaymentContractLine[];
}

export interface AchPaymentsData {
  lenderId: string;
  checks: AchPaymentCheck[];
  totalAmountCents: number;
}

export async function getAchPaymentsData(lenderIds: string[], startDate: string, endDate: string): Promise<AchPaymentsData[]> {
  if (lenderIds.length === 0) return [];

  const lenders = await db.select({ id: parties.id, displayName: parties.displayName }).from(parties).where(inArray(parties.id, lenderIds));
  const lenderIdByName = new Map(lenders.map((l) => [l.displayName, l.id]));
  if (lenderIdByName.size === 0) return [];

  const checkRows = await db
    .select({ id: checks.id, checkNumber: checks.checkNumber, checkDate: checks.checkDate, payeeName: checks.payeeName, totalAmountCents: checks.totalAmountCents })
    .from(checks)
    .where(
      and(
        eq(checks.paymentMethod, "ACH"),
        inArray(checks.payeeName, [...lenderIdByName.keys()]),
        gte(checks.checkDate, startDate),
        lte(checks.checkDate, endDate)
      )
    )
    .orderBy(checks.checkDate);

  const lineItemRows =
    checkRows.length === 0
      ? []
      : await db
          .select({
            checkId: checkLineItems.checkId,
            contractId: checkLineItems.contractId,
            contractNumber: contracts.contractNumber,
            amountCents: checkLineItems.amountCents,
            interestCents: checkLineItems.interestCents,
            principalCents: checkLineItems.principalCents,
            lateChargesCents: checkLineItems.lateChargesCents,
            chargesAmountCents: checkLineItems.chargesAmountCents,
          })
          .from(checkLineItems)
          .leftJoin(contracts, eq(checkLineItems.contractId, contracts.id))
          .where(
            inArray(
              checkLineItems.checkId,
              checkRows.map((c) => c.id)
            )
          );

  const byLender = new Map<string, AchPaymentCheck[]>();
  for (const check of checkRows) {
    const lenderId = lenderIdByName.get(check.payeeName);
    if (!lenderId) continue;
    const lines = lineItemRows
      .filter((li) => li.checkId === check.id)
      .map((li) => ({
        contractId: li.contractId,
        contractNumber: li.contractNumber,
        amountCents: li.amountCents,
        interestCents: li.interestCents,
        principalCents: li.principalCents,
        lateChargesCents: li.lateChargesCents,
        otherChargesCents: li.chargesAmountCents,
      }));
    const list = byLender.get(lenderId) ?? [];
    list.push({ checkId: check.id, checkNumber: check.checkNumber, checkDate: check.checkDate, totalAmountCents: check.totalAmountCents, lines });
    byLender.set(lenderId, list);
  }

  return lenderIds
    .filter((id) => byLender.has(id))
    .map((lenderId) => {
      const lenderChecks = byLender.get(lenderId)!;
      return {
        lenderId,
        checks: lenderChecks,
        totalAmountCents: lenderChecks.reduce((s, c) => s + c.totalAmountCents, 0),
      };
    });
}

export function renderAchPaymentsHtml(lenderName: string, data: AchPaymentsData | undefined, startDate: string, endDate: string): string {
  const checksHtml = (data?.checks ?? [])
    .map((c) => {
      const lineRows = c.lines
        .map(
          (l) =>
            `<tr><td>${l.contractNumber ?? "—"}</td><td style="text-align:right">${formatCents(l.amountCents)}</td><td style="text-align:right">${formatCents(l.interestCents)}</td><td style="text-align:right">${formatCents(l.principalCents)}</td><td style="text-align:right">${formatCents(l.lateChargesCents)}</td><td style="text-align:right">${formatCents(l.otherChargesCents)}</td></tr>`
        )
        .join("");
      return `
        <h3>${c.checkNumber} — ${formatDate(c.checkDate)} — ${formatCents(c.totalAmountCents)}</h3>
        <table cellpadding="4" style="border-collapse:collapse;width:100%;margin-bottom:1em">
          <thead><tr><th>Land Contract</th><th>Payment Amount</th><th>Interest Paid</th><th>Principal Paid</th><th>Late Charges</th><th>Other Charges</th></tr></thead>
          <tbody>${lineRows}</tbody>
        </table>
      `;
    })
    .join("");

  return `
    <h2>ACH Payments — ${lenderName}</h2>
    <p>${formatDate(startDate)} – ${formatDate(endDate)}</p>
    ${checksHtml || "<p>No ACH payments in this range.</p>"}
    <p style="font-weight:bold">Total: ${formatCents(data?.totalAmountCents ?? 0)}</p>
    <p style="font-size:0.85em;color:#666">Late Charges are the lender's own money and already included in Total. Other Charges are shown for context only — that revenue stays with GPM and is never part of the Total paid to the lender.</p>
  `;
}
