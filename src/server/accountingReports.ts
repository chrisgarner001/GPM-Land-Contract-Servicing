import { and, eq, gte, lte, desc, asc, isNull, sum } from "drizzle-orm";
import { db } from "@/db/client";
import { payments, paymentAllocations } from "@/db/schema/payments";
import { lenderLedgerEntries } from "@/db/schema/lending";
import { trustLedgerEntries } from "@/db/schema/escrow";
import { contracts } from "@/db/schema/contracts";
import { checks } from "@/db/schema/checks";
import { bankAccounts } from "@/db/schema/setup";
import { formatCents, formatDate } from "@/lib/format";

// This app has no general ledger — gl_codes is a reference picklist only,
// nothing posts amounts against it. These two reports are deliberately
// scoped to what's actually tracked here (loan-servicing cash activity):
// they do NOT reconcile with the real company-wide P&L/Balance Sheet in
// QuickBooks (payroll, rent, equity, etc. aren't recorded in this app at all).

// Late fees are lender revenue, not SGMS's (confirmed against real usage —
// see lenderLedger.ts's creditLendersForPayment) — this statement no longer
// counts them as servicing income. The flat broker servicing fee remains
// the only real revenue line this app can see.
export interface ServicingIncomeStatement {
  servicingFeesCents: number;
  totalIncomeCents: number;
}

export async function getServicingIncomeStatement(startDate: string, endDate: string): Promise<ServicingIncomeStatement> {
  const [feeRow] = await db
    .select({ total: sum(lenderLedgerEntries.servicingFeeCents) })
    .from(lenderLedgerEntries)
    .where(
      and(
        eq(lenderLedgerEntries.entryType, "PAYMENT_CREDIT"),
        gte(lenderLedgerEntries.transactionDate, startDate),
        lte(lenderLedgerEntries.transactionDate, endDate)
      )
    );

  const servicingFeesCents = Number(feeRow?.total ?? 0);
  return { servicingFeesCents, totalIncomeCents: servicingFeesCents };
}

export function renderServicingIncomeStatementHtml(data: ServicingIncomeStatement, startDate: string, endDate: string): string {
  return `
    <h2>Servicing Income Statement</h2>
    <p>${formatDate(startDate)} – ${formatDate(endDate)}</p>
    <p style="font-size:0.85em;color:#666">Loan-servicing income only — this app has no general ledger and does not
    track operating expenses (payroll, rent, etc.); those live in QuickBooks. Not the company-wide Profit &amp; Loss.
    Late fees are lender revenue, not SGMS's, and are not shown here — see the Lender Payment Run / ACH Payments
    reports.</p>
    <table cellpadding="4" style="border-collapse:collapse;width:100%">
      <tr><td>Broker/Servicing Fees Collected</td><td style="text-align:right">${formatCents(data.servicingFeesCents)}</td></tr>
      <tr style="font-weight:bold;border-top:1px solid #ccc"><td>Net Servicing Income</td><td style="text-align:right">${formatCents(data.totalIncomeCents)}</td></tr>
    </table>
  `;
}

export interface ServicingBalanceSheet {
  asOfDate: string;
  escrowHeldCents: number;
  lenderPayableCents: number;
  borrowerReserveHeldCents: number;
  totalPrincipalUnderServicingCents: number;
}

export async function getServicingBalanceSheet(asOfDate: string): Promise<ServicingBalanceSheet> {
  // Latest trust/escrow balance per contract as of the date — same
  // selectDistinctOn convention already used by Escrow Maintenance/New
  // Invoice for "the current balance," just filtered to a specific date.
  const escrowRows = await db
    .selectDistinctOn([trustLedgerEntries.contractId], {
      contractId: trustLedgerEntries.contractId,
      balanceCents: trustLedgerEntries.balanceCents,
    })
    .from(trustLedgerEntries)
    .where(lte(trustLedgerEntries.transactionDate, asOfDate))
    .orderBy(trustLedgerEntries.contractId, desc(trustLedgerEntries.transactionDate), desc(trustLedgerEntries.id));
  const escrowHeldCents = escrowRows.reduce((s, r) => s + (r.balanceCents ?? 0), 0);

  const lenderRows = await db
    .selectDistinctOn([lenderLedgerEntries.lenderPartyId], {
      lenderPartyId: lenderLedgerEntries.lenderPartyId,
      balanceCents: lenderLedgerEntries.balanceCents,
    })
    .from(lenderLedgerEntries)
    .where(lte(lenderLedgerEntries.transactionDate, asOfDate))
    .orderBy(lenderLedgerEntries.lenderPartyId, desc(lenderLedgerEntries.transactionDate), desc(lenderLedgerEntries.id));
  const lenderPayableCents = lenderRows.reduce((s, r) => s + (r.balanceCents ?? 0), 0);

  const [reserveRow] = await db
    .select({ total: sum(paymentAllocations.amountCents) })
    .from(paymentAllocations)
    .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
    .where(and(eq(paymentAllocations.allocationType, "SUSPENSE"), eq(payments.status, "CLEARED"), lte(payments.receivedDate, asOfDate)));
  const borrowerReserveHeldCents = Number(reserveRow?.total ?? 0);

  const [principalRow] = await db
    .select({ total: sum(contracts.currentPrincipalBalanceCents) })
    .from(contracts)
    .where(eq(contracts.status, "ACTIVE"));
  const totalPrincipalUnderServicingCents = Number(principalRow?.total ?? 0);

  return { asOfDate, escrowHeldCents, lenderPayableCents, borrowerReserveHeldCents, totalPrincipalUnderServicingCents };
}

export function renderServicingBalanceSheetHtml(data: ServicingBalanceSheet): string {
  return `
    <h2>Servicing Balance Sheet (Trust &amp; Portfolio Positions)</h2>
    <p>As of ${formatDate(data.asOfDate)}</p>
    <p style="font-size:0.85em;color:#666">This app has no general ledger and doesn't track the business's own cash,
    assets, or equity — these figures are trust/escrow and lender-payable positions this system holds on behalf of
    borrowers and lenders, plus a portfolio memo figure. Not the company-wide Balance Sheet.</p>
    <h3>Held on Behalf of Others (liabilities)</h3>
    <table cellpadding="4" style="border-collapse:collapse;width:100%">
      <tr><td>Escrow/Trust Held (for borrowers, to be disbursed for taxes/insurance)</td><td style="text-align:right">${formatCents(data.escrowHeldCents)}</td></tr>
      <tr><td>Lender Payable (collected, awaiting distribution)</td><td style="text-align:right">${formatCents(data.lenderPayableCents)}</td></tr>
      <tr><td>Borrower Reserve Held (partial payments not yet applied)</td><td style="text-align:right">${formatCents(data.borrowerReserveHeldCents)}</td></tr>
    </table>
    <h3>Portfolio Memo (informational — not an owned asset of this business)</h3>
    <table cellpadding="4" style="border-collapse:collapse;width:100%">
      <tr><td>Total Principal Under Servicing (active contracts)</td><td style="text-align:right">${formatCents(data.totalPrincipalUnderServicingCents)}</td></tr>
    </table>
  `;
}

export interface BankAccountOption {
  id: string;
  label: string;
}

export async function getBankAccountOptions(): Promise<BankAccountOption[]> {
  return db.select({ id: bankAccounts.id, label: bankAccounts.label }).from(bankAccounts).orderBy(asc(bankAccounts.label));
}

export interface CheckRegisterRow {
  id: string;
  checkNumber: string;
  checkDate: string;
  payeeName: string;
  payeeCode: string;
  paymentMethod: "CHECK" | "ACH";
  totalAmountCents: number;
}

export interface CheckRegisterData {
  bankAccountLabel: string;
  startDate: string;
  endDate: string;
  rows: CheckRegisterRow[];
  totalCents: number;
}

// "UNCLASSIFIED" surfaces every historical check the TMO import carried no
// bank account for and that isn't reconstructable as a lender distribution
// (see checks.bankAccountId's schema comment / scripts/backfill-check-bank-
// accounts.ts) — deliberately shown as its own bucket rather than folded
// into any real account, since there's no data to say which one it was.
export async function getCheckRegisterData(
  bankAccountFilter: string,
  startDate: string,
  endDate: string
): Promise<CheckRegisterData> {
  let bankAccountLabel = "All Accounts";
  const conditions = [gte(checks.checkDate, startDate), lte(checks.checkDate, endDate)];

  if (bankAccountFilter === "UNCLASSIFIED") {
    bankAccountLabel = "Unclassified";
    conditions.push(isNull(checks.bankAccountId));
  } else if (bankAccountFilter !== "ALL") {
    const [account] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, bankAccountFilter));
    bankAccountLabel = account?.label ?? "Unknown Account";
    conditions.push(eq(checks.bankAccountId, bankAccountFilter));
  }

  const rows = await db
    .select({
      id: checks.id,
      checkNumber: checks.checkNumber,
      checkDate: checks.checkDate,
      payeeName: checks.payeeName,
      payeeCode: checks.payeeCode,
      paymentMethod: checks.paymentMethod,
      totalAmountCents: checks.totalAmountCents,
    })
    .from(checks)
    .where(and(...conditions))
    .orderBy(asc(checks.checkDate), asc(checks.checkNumber));

  const totalCents = rows.reduce((s, r) => s + r.totalAmountCents, 0);
  return { bankAccountLabel, startDate, endDate, rows, totalCents };
}

export function renderCheckRegisterHtml(data: CheckRegisterData): string {
  const rowsHtml = data.rows
    .map(
      (r) => `
      <tr>
        <td>${formatDate(r.checkDate)}</td>
        <td>${r.checkNumber}</td>
        <td>${r.payeeName} (${r.payeeCode})</td>
        <td>${r.paymentMethod}</td>
        <td style="text-align:right">${formatCents(r.totalAmountCents)}</td>
      </tr>`
    )
    .join("");

  return `
    <h2>Check Register — ${data.bankAccountLabel}</h2>
    <p>${formatDate(data.startDate)} – ${formatDate(data.endDate)}</p>
    <table cellpadding="4" style="border-collapse:collapse;width:100%">
      <tr style="font-weight:bold;border-bottom:1px solid #ccc">
        <td>Date</td><td>Check #</td><td>Payee</td><td>Method</td><td style="text-align:right">Amount</td>
      </tr>
      ${rowsHtml}
      <tr style="font-weight:bold;border-top:1px solid #ccc"><td colspan="4">Total</td><td style="text-align:right">${formatCents(data.totalCents)}</td></tr>
    </table>
  `;
}
