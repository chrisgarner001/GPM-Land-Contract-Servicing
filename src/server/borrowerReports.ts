import { and, eq, gte, lte, gt, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts, contractParties } from "@/db/schema/contracts";
import { parties, properties } from "@/db/schema/parties";
import { payments } from "@/db/schema/payments";
import { contractCharges } from "@/db/schema/charges";
import { getEscrowAndReserveBalances, getUnpaidChargesCents } from "@/server/payments";
import { calculatePayoffQuote, type PayoffQuote } from "@/domain/amortization/calculatePayoffQuote";
import { calculateAmountDue, daysPastDue } from "@/domain/ledger/calculateAmountDue";
import { advanceNextPaymentDate, regressNextPaymentDate } from "@/domain/ledger/advanceNextPaymentDate";
import { formatCents, formatDate, formatPercent } from "@/lib/format";

export interface ContractOption {
  id: string;
  label: string;
  buyerEmail: string | null;
  borrowerPortalEmail: string | null;
}

// Defaults to ACTIVE only — the report pickers this feeds are for running
// statements/charges reports, where a paid-off (or defaulted/cancelled)
// contract is rarely wanted. includePaidOff adds PAID_OFF alongside ACTIVE;
// DEFAULTED/CANCELLED/IN_FORECLOSURE stay excluded either way since nothing
// asked for those.
export async function getBorrowerContractOptions(includePaidOff = false): Promise<ContractOption[]> {
  const statuses: ("ACTIVE" | "PAID_OFF")[] = includePaidOff ? ["ACTIVE", "PAID_OFF"] : ["ACTIVE"];

  const rows = await db
    .select({
      contractId: contracts.id,
      contractNumber: contracts.contractNumber,
      borrowerPortalEmail: contracts.borrowerPortalEmail,
      buyerName: parties.displayName,
      buyerEmail: parties.email,
    })
    .from(contractParties)
    .innerJoin(contracts, eq(contractParties.contractId, contracts.id))
    .innerJoin(parties, eq(contractParties.partyId, parties.id))
    .where(and(eq(contractParties.role, "BUYER"), inArray(contracts.status, statuses)))
    .orderBy(parties.displayName);

  return rows.map((r) => ({
    id: r.contractId,
    label: `${r.buyerName} — ${r.contractNumber}`,
    buyerEmail: r.buyerEmail,
    borrowerPortalEmail: r.borrowerPortalEmail,
  }));
}

export interface StatementOfAccountData {
  contractId: string;
  contractNumber: string;
  borrowerName: string;
  propertyAddress: string;
  currentPrincipalBalanceCents: number;
  interestRateAnnual: string;
  nextPaymentDate: string | null;
  maturityDate: string | null;
  paymentAmountCents: number;
  escrowBalanceCents: number | null;
  reserveBalanceCents: number;
  paymentHistory: {
    receivedDate: string;
    paymentMethod: string;
    amountCents: number;
    status: string;
    // Reconstructed, not stored — see getStatementOfAccountData. Null for
    // rows that never consumed a due-date slot (held-in-reserve deposits,
    // principal paydowns, reversed/reversal rows).
    dueDate: string | null;
  }[];
}

// Reconstructs each CLEARED, period-satisfying payment's due date by
// stepping contract.firstPaymentDate forward one period per payment, in the
// exact same order recordPayment/reversePayment itself advances/regresses
// contract.nextPaymentDate — so the last step of this walk always lands on
// the contract's actual current nextPaymentDate. This is an ESTIMATE, not a
// stored fact: a contract with irregular history (skipped/extra payments
// this walk can't distinguish from a normal one) can drift from ground
// truth, which is exactly why callers must label it "(est.)".
function reconstructDueDates<
  T extends { id: string; receivedDate: string; status: string; legacyDescription: string | null; reversedPaymentId: string | null }
>(paymentsAsc: T[], firstPaymentDate: string, paymentFrequency: "MONTHLY" | "SEMI_MONTHLY" | "BIWEEKLY"): Map<string, string | null> {
  let currentDueDate = firstPaymentDate;
  const dueDateByPaymentId = new Map<string, string | null>();

  for (const p of paymentsAsc) {
    if (p.reversedPaymentId !== null) {
      // This row IS a reversal (the negated offsetting entry) — undoes the
      // period its original satisfied.
      currentDueDate = regressNextPaymentDate(currentDueDate, paymentFrequency);
      dueDateByPaymentId.set(p.id, null);
      continue;
    }
    const satisfiedAPeriod =
      p.status === "CLEARED" &&
      p.legacyDescription !== "Partial Payment (Held in Reserve)" &&
      p.legacyDescription !== "Principal Paydown";
    if (!satisfiedAPeriod) {
      dueDateByPaymentId.set(p.id, null);
      continue;
    }
    dueDateByPaymentId.set(p.id, currentDueDate);
    currentDueDate = advanceNextPaymentDate(currentDueDate, paymentFrequency);
  }

  return dueDateByPaymentId;
}

export async function getStatementOfAccountData(contractId: string, startDate: string, endDate: string): Promise<StatementOfAccountData> {
  const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!contract) throw new Error("Contract not found.");

  const [property] = await db.select().from(properties).where(eq(properties.id, contract.propertyId));

  const [buyer] = await db
    .select({ displayName: parties.displayName })
    .from(contractParties)
    .innerJoin(parties, eq(contractParties.partyId, parties.id))
    .where(and(eq(contractParties.contractId, contractId), eq(contractParties.role, "BUYER")));

  // Fetched for the FULL contract history (not date-range-limited) since
  // each payment's reconstructed due date depends on its position in the
  // complete chronological sequence from firstPaymentDate, not just on
  // whichever payments happen to fall inside this report's date range.
  const allPaymentsAsc = await db
    .select({
      id: payments.id,
      receivedDate: payments.receivedDate,
      paymentMethod: payments.paymentMethod,
      amountCents: payments.amountCents,
      status: payments.status,
      legacyDescription: payments.legacyDescription,
      reversedPaymentId: payments.reversedPaymentId,
    })
    .from(payments)
    .where(eq(payments.contractId, contractId))
    .orderBy(payments.receivedDate, payments.createdAt);

  const dueDateByPaymentId = reconstructDueDates(allPaymentsAsc, contract.firstPaymentDate, contract.paymentFrequency);

  const paymentHistory = allPaymentsAsc
    .filter((p) => p.receivedDate >= startDate && p.receivedDate <= endDate)
    .map((p) => ({
      receivedDate: p.receivedDate,
      paymentMethod: p.paymentMethod,
      amountCents: p.amountCents,
      status: p.status,
      dueDate: dueDateByPaymentId.get(p.id) ?? null,
    }));

  const { escrowBalanceCents, reserveBalanceCents } = await getEscrowAndReserveBalances(contractId);

  return {
    contractId,
    contractNumber: contract.contractNumber,
    borrowerName: buyer?.displayName ?? "—",
    propertyAddress: property ? `${property.streetAddress}, ${property.city}, ${property.state}` : "—",
    currentPrincipalBalanceCents: contract.currentPrincipalBalanceCents,
    interestRateAnnual: contract.interestRateAnnual,
    nextPaymentDate: contract.nextPaymentDate,
    maturityDate: contract.maturityDate,
    paymentAmountCents: contract.paymentAmountCents,
    escrowBalanceCents,
    reserveBalanceCents,
    paymentHistory,
  };
}

// One query set per contract, run in parallel — not the same N+1 concern as
// e.g. Lender Payment Run's background batch job, since this is bounded by
// however many contracts staff actually check in the report picker, not an
// unbounded portfolio-wide sweep.
export async function getStatementsOfAccount(contractIds: string[], startDate: string, endDate: string): Promise<StatementOfAccountData[]> {
  return Promise.all(contractIds.map((id) => getStatementOfAccountData(id, startDate, endDate)));
}

export function renderStatementOfAccountHtml(data: StatementOfAccountData, startDate: string, endDate: string): string {
  const rows = data.paymentHistory
    .map(
      (p) =>
        `<tr><td>${formatDate(p.receivedDate)}</td><td>${p.dueDate ? formatDate(p.dueDate) : "—"}</td><td>${p.paymentMethod}</td><td style="text-align:right">${formatCents(p.amountCents)}</td><td>${p.status}</td></tr>`
    )
    .join("");

  return `
    <h2>Statement of Account — ${data.contractNumber}</h2>
    <p>${data.borrowerName}<br>${data.propertyAddress}</p>
    <table cellpadding="4">
      <tr><td>Principal Balance</td><td>${formatCents(data.currentPrincipalBalanceCents)}</td></tr>
      <tr><td>Interest Rate</td><td>${formatPercent(data.interestRateAnnual)}</td></tr>
      <tr><td>Next Payment Date</td><td>${formatDate(data.nextPaymentDate)}</td></tr>
      <tr><td>Maturity Date</td><td>${formatDate(data.maturityDate)}</td></tr>
      <tr><td>Regular Payment</td><td>${formatCents(data.paymentAmountCents)}</td></tr>
      <tr><td>Escrow Balance</td><td>${formatCents(data.escrowBalanceCents)}</td></tr>
      <tr><td>Reserve Balance</td><td>${formatCents(data.reserveBalanceCents)}</td></tr>
    </table>
    <h3>Payment History (${formatDate(startDate)} – ${formatDate(endDate)})</h3>
    <table cellpadding="4" style="border-collapse:collapse;width:100%">
      <thead><tr><th>Date</th><th>Due Date (est.)</th><th>Method</th><th>Amount</th><th>Status</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">No payments in this range.</td></tr>'}</tbody>
    </table>
  `;
}

export interface OutstandingChargesData {
  contractId: string;
  contractNumber: string;
  borrowerName: string;
  charges: { chargeDate: string; description: string; amountCents: number; remainingCents: number }[];
  totalRemainingCents: number;
}

export async function getOutstandingChargesData(contractId: string, startDate: string, endDate: string): Promise<OutstandingChargesData> {
  const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!contract) throw new Error("Contract not found.");

  const [buyer] = await db
    .select({ displayName: parties.displayName })
    .from(contractParties)
    .innerJoin(parties, eq(contractParties.partyId, parties.id))
    .where(and(eq(contractParties.contractId, contractId), eq(contractParties.role, "BUYER")));

  const charges = await db
    .select({
      chargeDate: contractCharges.chargeDate,
      description: contractCharges.description,
      amountCents: contractCharges.amountCents,
      remainingCents: contractCharges.remainingCents,
    })
    .from(contractCharges)
    .where(
      and(
        eq(contractCharges.contractId, contractId),
        gt(contractCharges.remainingCents, 0),
        gte(contractCharges.chargeDate, startDate),
        lte(contractCharges.chargeDate, endDate)
      )
    )
    .orderBy(contractCharges.chargeDate);

  return {
    contractId,
    contractNumber: contract.contractNumber,
    borrowerName: buyer?.displayName ?? "—",
    charges,
    totalRemainingCents: charges.reduce((s, c) => s + c.remainingCents, 0),
  };
}

export async function getMultipleOutstandingCharges(contractIds: string[], startDate: string, endDate: string): Promise<OutstandingChargesData[]> {
  return Promise.all(contractIds.map((id) => getOutstandingChargesData(id, startDate, endDate)));
}

export function renderOutstandingChargesHtml(data: OutstandingChargesData, startDate: string, endDate: string): string {
  const rows = data.charges
    .map(
      (c) =>
        `<tr><td>${formatDate(c.chargeDate)}</td><td>${c.description}</td><td style="text-align:right">${formatCents(c.amountCents)}</td><td style="text-align:right">${formatCents(c.remainingCents)}</td></tr>`
    )
    .join("");

  return `
    <h2>Outstanding Charges — ${data.contractNumber}</h2>
    <p>${data.borrowerName}</p>
    <p>${formatDate(startDate)} – ${formatDate(endDate)}</p>
    <table cellpadding="4" style="border-collapse:collapse;width:100%">
      <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Remaining</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4">No unpaid charges in this range.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="3">Total</td><td style="text-align:right">${formatCents(data.totalRemainingCents)}</td></tr></tfoot>
    </table>
  `;
}

export interface NameAddressRow {
  contractNumber: string;
  displayName: string;
  phone: string | null;
  mailingAddressLine1: string | null;
  mailingCity: string | null;
  mailingState: string | null;
  mailingZip: string | null;
}

export async function getNameAddressListing(): Promise<NameAddressRow[]> {
  return db
    .select({
      contractNumber: contracts.contractNumber,
      displayName: parties.displayName,
      phone: parties.phone,
      mailingAddressLine1: parties.mailingAddressLine1,
      mailingCity: parties.mailingCity,
      mailingState: parties.mailingState,
      mailingZip: parties.mailingZip,
    })
    .from(contractParties)
    .innerJoin(contracts, eq(contractParties.contractId, contracts.id))
    .innerJoin(parties, eq(contractParties.partyId, parties.id))
    .where(eq(contractParties.role, "BUYER"))
    .orderBy(parties.displayName);
}

// The quote is only good through whichever comes first: the end of the
// payoff date's month, or the next regular payment due date — once a new
// payment is due, the principal balance this quote is based on could change,
// so the per-diem window can't be assumed to extend past that.
function quoteExpirationDate(payoffDate: string, nextPaymentDate: string | null): string {
  const payoff = new Date(`${payoffDate}T00:00:00Z`);
  const endOfMonth = new Date(Date.UTC(payoff.getUTCFullYear(), payoff.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  if (!nextPaymentDate) return endOfMonth;
  return nextPaymentDate < endOfMonth ? nextPaymentDate : endOfMonth;
}

export interface PayoffLetterData {
  contractId: string;
  contractNumber: string;
  borrowerName: string;
  propertyAddress: string;
  recipientName: string;
  payoffDate: string;
  quote: PayoffQuote;
  expirationDate: string;
}

export async function getPayoffLetterData(contractId: string, payoffDate: string, recipientName: string): Promise<PayoffLetterData> {
  const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!contract) throw new Error("Contract not found.");
  if (!contract.nextPaymentDate) throw new Error("This contract has no next payment date on file — a payoff quote needs one.");

  const [property] = await db.select().from(properties).where(eq(properties.id, contract.propertyId));

  const [buyer] = await db
    .select({ displayName: parties.displayName })
    .from(contractParties)
    .innerJoin(parties, eq(contractParties.partyId, parties.id))
    .where(and(eq(contractParties.contractId, contractId), eq(contractParties.role, "BUYER")));

  const lastDueDate = regressNextPaymentDate(contract.nextPaymentDate, contract.paymentFrequency);

  const amountDue = calculateAmountDue({
    paymentAmountCents: contract.paymentAmountCents,
    daysPastDue: daysPastDue(contract.nextPaymentDate),
    lateFeeGraceDays: contract.lateFeeGraceDays,
    lateFeeType: contract.lateFeeType,
    lateFeeAmountCents: contract.lateFeeAmountCents,
    lateFeePercent: contract.lateFeePercent,
  });
  const unpaidOtherChargesCents = await getUnpaidChargesCents(contractId);

  const quote = calculatePayoffQuote({
    principalBalanceCents: contract.currentPrincipalBalanceCents,
    annualRatePercent: Number(contract.interestRateAnnual),
    lastDueDate,
    payoffDate,
    unpaidLateChargesCents: amountDue.lateFeeCents,
    unpaidOtherChargesCents,
  });

  return {
    contractId,
    contractNumber: contract.contractNumber,
    borrowerName: buyer?.displayName ?? "—",
    propertyAddress: property ? `${property.streetAddress}, ${property.city}, ${property.state}` : "—",
    recipientName,
    payoffDate,
    quote,
    expirationDate: quoteExpirationDate(payoffDate, contract.nextPaymentDate),
  };
}

export function renderPayoffLetterHtml(data: PayoffLetterData): string {
  return `
    <h2>Payoff Letter — ${data.contractNumber}</h2>
    <p>${data.recipientName ? `${data.recipientName}<br>` : ""}Re: ${data.borrowerName}<br>${data.propertyAddress}</p>
    <p>As of <strong>${formatDate(data.payoffDate)}</strong>, the payoff amount for this land contract is:</p>
    <table cellpadding="4">
      <tr><td>Principal Balance</td><td>${formatCents(data.quote.principalBalanceCents)}</td></tr>
      <tr><td>Accrued Interest (${data.quote.days} days)</td><td>${formatCents(data.quote.accruedInterestCents)}</td></tr>
      ${data.quote.unpaidInterestCents ? `<tr><td>Unpaid Prior Interest</td><td>${formatCents(data.quote.unpaidInterestCents)}</td></tr>` : ""}
      ${data.quote.unpaidLateChargesCents ? `<tr><td>Late Charges</td><td>${formatCents(data.quote.unpaidLateChargesCents)}</td></tr>` : ""}
      ${data.quote.unpaidOtherChargesCents ? `<tr><td>Other Charges</td><td>${formatCents(data.quote.unpaidOtherChargesCents)}</td></tr>` : ""}
      <tr><td><strong>Total Payoff Amount</strong></td><td><strong>${formatCents(data.quote.totalPayoffAmountCents)}</strong></td></tr>
    </table>
    <p>
      This quote is valid through <strong>${formatDate(data.expirationDate)}</strong>. If payoff is received after
      ${formatDate(data.payoffDate)}, add <strong>${formatCents(data.quote.perDiemInterestCents)}</strong> per day for each
      additional day through the expiration date. A new payoff quote is required after that date.
    </p>
  `;
}

export function renderNameAddressListingHtml(rows: NameAddressRow[]): string {
  const body = rows
    .map(
      (r) =>
        `<tr><td>${r.contractNumber}</td><td>${r.displayName}</td><td>${r.phone ?? "—"}</td><td>${[r.mailingAddressLine1, r.mailingCity, r.mailingState, r.mailingZip].filter(Boolean).join(", ") || "—"}</td></tr>`
    )
    .join("");

  return `
    <h2>Borrower Name &amp; Address Listing</h2>
    <table cellpadding="4" style="border-collapse:collapse;width:100%">
      <thead><tr><th>Land Contract</th><th>Name</th><th>Phone</th><th>Mailing Address</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  `;
}
