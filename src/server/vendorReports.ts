import { and, eq, gte, lte, isNull, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { vendors, vendorDisbursements } from "@/db/schema/vendors";
import { contracts } from "@/db/schema/contracts";
import { checks } from "@/db/schema/checks";
import { lenderLedgerEntries } from "@/db/schema/lending";
import { contractCharges } from "@/db/schema/charges";
import { formatCents, formatDate } from "@/lib/format";

export interface VendorOption {
  id: string;
  displayName: string;
}

export async function getVendorOptions(): Promise<VendorOption[]> {
  return db.select({ id: vendors.id, displayName: vendors.displayName }).from(vendors).orderBy(vendors.displayName);
}

export interface VendorNameAddressRow {
  displayName: string;
  vendorAccountCode: string;
  email: string | null;
  addressLine1: string | null;
  cityStateZip: string | null;
}

export async function getVendorNameAddressListing(): Promise<VendorNameAddressRow[]> {
  return db
    .select({
      displayName: vendors.displayName,
      vendorAccountCode: vendors.vendorAccountCode,
      email: vendors.email,
      addressLine1: vendors.addressLine1,
      cityStateZip: vendors.cityStateZip,
    })
    .from(vendors)
    .orderBy(vendors.displayName);
}

export function renderVendorNameAddressListingHtml(rows: VendorNameAddressRow[]): string {
  const body = rows
    .map(
      (r) =>
        `<tr><td>${r.displayName}</td><td>${r.vendorAccountCode}</td><td>${r.email ?? "—"}</td><td>${[r.addressLine1, r.cityStateZip].filter(Boolean).join(", ") || "—"}</td></tr>`
    )
    .join("");

  return `
    <h2>Vendor Name &amp; Address Listing</h2>
    <table cellpadding="4" style="border-collapse:collapse;width:100%">
      <thead><tr><th>Name</th><th>Account Code</th><th>Email</th><th>Mailing Address</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

// ---------------------------------------------------------------------------
// Statement of Account — every disbursement in the range, with the actual
// check it went out on when one exists (checkId — set once run through
// Print Checks; always null for TMO-imported historical rows, which are
// already-real payments with no linked check record, and for non-check
// payment methods, which this app has no "paid" signal for beyond the
// disbursement itself already having been posted).
//
// "Charged to Lender" / "Charged to Borrower" — same correlation the Lender
// Portfolio Charges report uses, since a vendor invoice's CHARGE_LENDER mode
// (createVendorInvoice) inserts a vendor_disbursements row, one or more
// lender_ledger_entries CHARGE_DEBIT rows (one per active lender on the
// contract), and one contract_charges row in the same transaction — with no
// shared id between any of them. Matched on (contractId, date), plus vendorId
// for the borrower side (contract_charges carries it; lender_ledger_entries
// doesn't). Invoices paid from escrow (the default mode) match neither and
// correctly show $0 for both — nobody but escrow was charged.
// ---------------------------------------------------------------------------
export interface VendorStatementLine {
  transactionDate: string;
  contractNumber: string | null;
  reference: string | null;
  glCode: string | null;
  amountCents: number;
  chargedToLenderCents: number;
  chargedToBorrowerCents: number;
  checkNumber: string | null;
  checkDate: string | null;
}

export interface VendorStatementData {
  vendorId: string;
  lines: VendorStatementLine[];
  totalCents: number;
  totalChargedToLenderCents: number;
  totalChargedToBorrowerCents: number;
}

export async function getVendorStatementOfAccount(vendorIds: string[], startDate: string, endDate: string): Promise<VendorStatementData[]> {
  if (vendorIds.length === 0) return [];

  const rows = await db
    .select({
      vendorId: vendorDisbursements.vendorId,
      contractId: vendorDisbursements.contractId,
      transactionDate: vendorDisbursements.transactionDate,
      contractNumber: contracts.contractNumber,
      reference: vendorDisbursements.reference,
      glCode: vendorDisbursements.glCode,
      amountCents: vendorDisbursements.amountCents,
      checkNumber: checks.checkNumber,
      checkDate: checks.checkDate,
    })
    .from(vendorDisbursements)
    .innerJoin(contracts, eq(vendorDisbursements.contractId, contracts.id))
    .leftJoin(checks, eq(vendorDisbursements.checkId, checks.id))
    .where(
      and(
        inArray(vendorDisbursements.vendorId, vendorIds),
        gte(vendorDisbursements.transactionDate, startDate),
        lte(vendorDisbursements.transactionDate, endDate)
      )
    )
    .orderBy(vendorDisbursements.transactionDate);

  const contractIds = [...new Set(rows.map((r) => r.contractId))];

  const lenderCharges =
    contractIds.length > 0
      ? await db
          .select({
            contractId: lenderLedgerEntries.sourceContractId,
            transactionDate: lenderLedgerEntries.transactionDate,
            amountPaidOutCents: lenderLedgerEntries.amountPaidOutCents,
          })
          .from(lenderLedgerEntries)
          .where(and(eq(lenderLedgerEntries.entryType, "CHARGE_DEBIT"), inArray(lenderLedgerEntries.sourceContractId, contractIds)))
      : [];

  const borrowerCharges =
    contractIds.length > 0
      ? await db
          .select({
            contractId: contractCharges.contractId,
            chargeDate: contractCharges.chargeDate,
            vendorId: contractCharges.vendorId,
            amountCents: contractCharges.amountCents,
          })
          .from(contractCharges)
          .where(inArray(contractCharges.contractId, contractIds))
      : [];

  function chargedToLenderCents(contractId: string, transactionDate: string): number {
    return lenderCharges
      .filter((c) => c.contractId === contractId && c.transactionDate === transactionDate)
      .reduce((s, c) => s + (c.amountPaidOutCents ?? 0), 0);
  }

  function chargedToBorrowerCents(contractId: string, transactionDate: string, vendorId: string): number {
    const match = borrowerCharges.find(
      (c) => c.contractId === contractId && c.chargeDate === transactionDate && c.vendorId === vendorId
    );
    return match?.amountCents ?? 0;
  }

  const byVendor = new Map<string, VendorStatementLine[]>();
  for (const r of rows) {
    const list = byVendor.get(r.vendorId) ?? [];
    list.push({
      transactionDate: r.transactionDate,
      contractNumber: r.contractNumber,
      reference: r.reference,
      glCode: r.glCode,
      amountCents: r.amountCents,
      chargedToLenderCents: chargedToLenderCents(r.contractId, r.transactionDate),
      chargedToBorrowerCents: chargedToBorrowerCents(r.contractId, r.transactionDate, r.vendorId),
      checkNumber: r.checkNumber,
      checkDate: r.checkDate,
    });
    byVendor.set(r.vendorId, list);
  }

  return vendorIds.map((vendorId) => {
    const lines = byVendor.get(vendorId) ?? [];
    return {
      vendorId,
      lines,
      totalCents: lines.reduce((s, l) => s + l.amountCents, 0),
      totalChargedToLenderCents: lines.reduce((s, l) => s + l.chargedToLenderCents, 0),
      totalChargedToBorrowerCents: lines.reduce((s, l) => s + l.chargedToBorrowerCents, 0),
    };
  });
}

export function renderVendorStatementHtml(vendorName: string, data: VendorStatementData, startDate: string, endDate: string): string {
  const rows = data.lines
    .map(
      (l) =>
        `<tr><td>${formatDate(l.transactionDate)}</td><td>${l.contractNumber ?? "—"}</td><td>${l.glCode ?? "—"}</td><td>${l.reference ?? "—"}</td><td style="text-align:right">${formatCents(l.amountCents)}</td><td style="text-align:right">${l.chargedToLenderCents ? formatCents(l.chargedToLenderCents) : "—"}</td><td style="text-align:right">${l.chargedToBorrowerCents ? formatCents(l.chargedToBorrowerCents) : "—"}</td><td>${l.checkNumber ?? "—"}</td><td>${l.checkDate ? formatDate(l.checkDate) : "—"}</td></tr>`
    )
    .join("");

  return `
    <h2>Vendor Statement of Account — ${vendorName}</h2>
    <p>${formatDate(startDate)} – ${formatDate(endDate)}</p>
    <table cellpadding="4" style="border-collapse:collapse;width:100%">
      <thead><tr><th>Date</th><th>Land Contract</th><th>GL Code</th><th>Reference</th><th>Amount</th><th>Charged to Lender</th><th>Charged to Borrower</th><th>Check #</th><th>Check Date</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="9">No activity in this range.</td></tr>'}</tbody>
      <tfoot><tr>
        <td colspan="4">Total</td>
        <td style="text-align:right">${formatCents(data.totalCents)}</td>
        <td style="text-align:right">${formatCents(data.totalChargedToLenderCents)}</td>
        <td style="text-align:right">${formatCents(data.totalChargedToBorrowerCents)}</td>
        <td colspan="2"></td>
      </tr></tfoot>
    </table>
  `;
}

// ---------------------------------------------------------------------------
// Unpaid Charges — disbursements recorded via New Invoice as "pay by check"
// that haven't been run through Print Checks yet (paymentMethod = 'CHECK'
// AND checkId IS NULL). Historical TMO-imported rows never carry a
// paymentMethod at all, so this naturally excludes them — they're already
// real, already-paid transactions, not pending ones. Other payment methods
// (ACH, CASH, etc.) have no "paid" tracking in this app beyond the
// disbursement itself already being posted, so they're never "unpaid."
// ---------------------------------------------------------------------------
export interface VendorUnpaidChargeRow {
  id: string;
  dueDate: string;
  contractNumber: string | null;
  glCode: string | null;
  amountCents: number;
  paymentMethod: string;
}

export interface VendorUnpaidChargesData {
  vendorId: string;
  rows: VendorUnpaidChargeRow[];
  totalCents: number;
}

export async function getVendorUnpaidCharges(vendorIds: string[], startDate: string, endDate: string): Promise<VendorUnpaidChargesData[]> {
  if (vendorIds.length === 0) return [];

  const rows = await db
    .select({
      id: vendorDisbursements.id,
      vendorId: vendorDisbursements.vendorId,
      dueDate: vendorDisbursements.transactionDate,
      contractNumber: contracts.contractNumber,
      glCode: vendorDisbursements.glCode,
      amountCents: vendorDisbursements.amountCents,
      paymentMethod: vendorDisbursements.paymentMethod,
    })
    .from(vendorDisbursements)
    .innerJoin(contracts, eq(vendorDisbursements.contractId, contracts.id))
    .where(
      and(
        eq(vendorDisbursements.paymentMethod, "CHECK"),
        isNull(vendorDisbursements.checkId),
        gte(vendorDisbursements.transactionDate, startDate),
        lte(vendorDisbursements.transactionDate, endDate)
      )
    )
    .orderBy(vendorDisbursements.transactionDate);

  const byVendor = new Map<string, VendorUnpaidChargeRow[]>();
  for (const r of rows) {
    if (!vendorIds.includes(r.vendorId)) continue;
    const list = byVendor.get(r.vendorId) ?? [];
    list.push({
      id: r.id,
      dueDate: r.dueDate,
      contractNumber: r.contractNumber,
      glCode: r.glCode,
      amountCents: r.amountCents,
      paymentMethod: r.paymentMethod ?? "CHECK",
    });
    byVendor.set(r.vendorId, list);
  }

  return vendorIds.map((vendorId) => {
    const rows = byVendor.get(vendorId) ?? [];
    return { vendorId, rows, totalCents: rows.reduce((s, r) => s + r.amountCents, 0) };
  });
}

export function renderVendorUnpaidChargesHtml(vendorName: string, data: VendorUnpaidChargesData, startDate: string, endDate: string): string {
  const rows = data.rows
    .map(
      (r) =>
        `<tr><td>${r.glCode ?? "—"}</td><td>${r.contractNumber ?? "—"}</td><td>${formatDate(r.dueDate)}</td><td style="text-align:right">${formatCents(r.amountCents)}</td><td>${r.paymentMethod}</td></tr>`
    )
    .join("");

  return `
    <h2>Vendor Unpaid Charges — ${vendorName}</h2>
    <p>${formatDate(startDate)} – ${formatDate(endDate)}</p>
    <p style="font-size:0.85em;color:#666">Invoices marked "pay by check" that haven't been printed yet (see Vendors &gt; Print Checks). Other payment methods have no pending state in this system once entered.</p>
    <table cellpadding="4" style="border-collapse:collapse;width:100%">
      <thead><tr><th>GL Code</th><th>Land Contract</th><th>Due Date</th><th>Amount</th><th>Payment Type</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">No unpaid charges in this range.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="3">Total</td><td style="text-align:right">${formatCents(data.totalCents)}</td><td></td></tr></tfoot>
    </table>
  `;
}
