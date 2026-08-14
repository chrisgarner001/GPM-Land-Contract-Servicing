import { and, eq, ne, isNull, inArray, asc } from "drizzle-orm";
import { db } from "@/db/client";
import { checks, checkLineItems } from "@/db/schema/checks";
import { bankAccounts } from "@/db/schema/setup";
import { contracts, contractParties } from "@/db/schema/contracts";
import { parties } from "@/db/schema/parties";
import { vendors, vendorDisbursements } from "@/db/schema/vendors";
import type { CheckPrintData } from "@/lib/checkPdf";

export interface UnprintedCheckSummary {
  id: string;
  checkNumber: string;
  checkDate: string;
  payeeName: string;
  totalAmountCents: number;
}

// Checks drawn on a given bank account (identified by label, e.g. "Owner
// Trust") that haven't been run through Print Checks yet.
export async function getUnprintedChecks(bankAccountLabel: string): Promise<UnprintedCheckSummary[]> {
  const rows = await db
    .select({
      id: checks.id,
      checkNumber: checks.checkNumber,
      checkDate: checks.checkDate,
      payeeName: checks.payeeName,
      totalAmountCents: checks.totalAmountCents,
    })
    .from(checks)
    .innerJoin(bankAccounts, eq(checks.bankAccountId, bankAccounts.id))
    .where(and(eq(bankAccounts.label, bankAccountLabel), eq(checks.paymentMethod, "CHECK"), isNull(checks.printedAt)))
    .orderBy(asc(checks.checkDate), asc(checks.checkNumber));
  return rows;
}

// Full stub detail for a set of already-created checks — used to render the
// printable PDF for both the Lender flow (checks created by a Payment Run)
// and the Vendor flow (checks created by createVendorChecks below).
export async function getCheckPrintData(checkIds: string[]): Promise<CheckPrintData[]> {
  if (checkIds.length === 0) return [];

  const checkRows = await db.select().from(checks).where(inArray(checks.id, checkIds));

  const lineItemRows = await db
    .select({
      checkId: checkLineItems.checkId,
      amountCents: checkLineItems.amountCents,
      servicingFeeCents: checkLineItems.servicingFeeCents,
      interestCents: checkLineItems.interestCents,
      principalCents: checkLineItems.principalCents,
      lateChargesCents: checkLineItems.lateChargesCents,
      chargesAmountCents: checkLineItems.chargesAmountCents,
      chargesInterestCents: checkLineItems.chargesInterestCents,
      otherPaymentsCents: checkLineItems.otherPaymentsCents,
      loanAccountRaw: checkLineItems.loanAccountRaw,
      contractNumber: contracts.contractNumber,
      borrowerName: parties.displayName,
    })
    .from(checkLineItems)
    .leftJoin(contracts, eq(checkLineItems.contractId, contracts.id))
    .leftJoin(
      contractParties,
      and(eq(contractParties.contractId, contracts.id), eq(contractParties.role, "BUYER"))
    )
    .leftJoin(parties, eq(contractParties.partyId, parties.id))
    .where(inArray(checkLineItems.checkId, checkIds));

  return checkRows.map((check) => ({
    checkNumber: check.checkNumber,
    checkDate: check.checkDate,
    payeeName: check.payeeName,
    amountCents: check.totalAmountCents,
    lineItems: lineItemRows
      .filter((li) => li.checkId === check.id)
      .map((li) => ({
        loanNo: li.contractNumber ?? li.loanAccountRaw ?? "",
        borrowerName: li.borrowerName ?? "",
        dateDue: null,
        totalPaymentCents: li.amountCents,
        feesCents: li.servicingFeeCents,
        interestCents: li.interestCents,
        principalCents: li.principalCents,
        otherCents: li.lateChargesCents + li.chargesAmountCents + li.chargesInterestCents + li.otherPaymentsCents,
        principalBalCents: null,
      })),
  }));
}

export async function markChecksPrinted(checkIds: string[]): Promise<void> {
  if (checkIds.length === 0) return;
  await db.update(checks).set({ printedAt: new Date() }).where(inArray(checks.id, checkIds));
}

export interface BankAccountOption {
  id: string;
  label: string;
}

// Vendor checks are only ever drawn on Escrow or Operating — Owner Trust is
// the lender-distribution account (see Lender Payment Runs).
export async function getVendorPayableBankAccountOptions(): Promise<BankAccountOption[]> {
  return db
    .select({ id: bankAccounts.id, label: bankAccounts.label })
    .from(bankAccounts)
    .where(ne(bankAccounts.label, "Owner Trust"))
    .orderBy(asc(bankAccounts.label));
}

export interface UnprintedVendorDisbursement {
  id: string;
  vendorId: string;
  vendorDisplayName: string;
  vendorAccountCode: string;
  contractId: string;
  contractNumber: string;
  transactionDate: string;
  reference: string | null;
  amountCents: number;
}

// Vendor invoices marked "pay by check" (New Invoice form) that haven't been
// included on a printed check yet.
export async function getUnprintedVendorDisbursements(): Promise<UnprintedVendorDisbursement[]> {
  const rows = await db
    .select({
      id: vendorDisbursements.id,
      vendorId: vendorDisbursements.vendorId,
      vendorDisplayName: vendors.displayName,
      vendorAccountCode: vendors.vendorAccountCode,
      contractId: vendorDisbursements.contractId,
      contractNumber: contracts.contractNumber,
      transactionDate: vendorDisbursements.transactionDate,
      reference: vendorDisbursements.reference,
      amountCents: vendorDisbursements.amountCents,
    })
    .from(vendorDisbursements)
    .innerJoin(vendors, eq(vendorDisbursements.vendorId, vendors.id))
    .innerJoin(contracts, eq(vendorDisbursements.contractId, contracts.id))
    .where(and(eq(vendorDisbursements.paymentMethod, "CHECK"), isNull(vendorDisbursements.checkId)))
    .orderBy(asc(vendors.displayName), asc(vendorDisbursements.transactionDate));
  return rows;
}

export interface CreateVendorChecksInput {
  disbursementIds: string[];
  bankAccountId: string;
  checkDate: string;
  startingCheckNumber: number;
}

// Groups the selected disbursements by vendor (a check has one payee), one
// check per vendor group, numbered sequentially from startingCheckNumber in
// vendor-name order — mirrors the physical pre-numbered check stock: the
// operator tells us what number is loaded in the printer next, we don't
// generate it ourselves. Also writes matching checkLineItems (amountCents
// only — vendor disbursements don't carry the interest/principal/fee
// breakdown that loan-payment distributions do) so this app's existing
// check-register reports keep working uniformly for printed and imported
// checks alike.
export async function createVendorChecks(input: CreateVendorChecksInput): Promise<string[]> {
  const { disbursementIds, bankAccountId, checkDate, startingCheckNumber } = input;
  if (disbursementIds.length === 0) return [];

  const disbursements = await db
    .select({
      id: vendorDisbursements.id,
      vendorId: vendorDisbursements.vendorId,
      vendorDisplayName: vendors.displayName,
      vendorAccountCode: vendors.vendorAccountCode,
      contractId: vendorDisbursements.contractId,
      amountCents: vendorDisbursements.amountCents,
    })
    .from(vendorDisbursements)
    .innerJoin(vendors, eq(vendorDisbursements.vendorId, vendors.id))
    .where(inArray(vendorDisbursements.id, disbursementIds));

  const byVendor = new Map<string, typeof disbursements>();
  for (const d of disbursements) {
    const group = byVendor.get(d.vendorId) ?? [];
    group.push(d);
    byVendor.set(d.vendorId, group);
  }
  const vendorGroups = [...byVendor.values()].sort((a, b) => a[0].vendorDisplayName.localeCompare(b[0].vendorDisplayName));

  const newCheckIds: string[] = [];

  await db.transaction(async (tx) => {
    for (let i = 0; i < vendorGroups.length; i++) {
      const group = vendorGroups[i];
      const checkNumber = String(startingCheckNumber + i);
      const totalAmountCents = group.reduce((s, d) => s + d.amountCents, 0);

      const [check] = await tx
        .insert(checks)
        .values({
          checkNumber,
          checkDate,
          payeeCode: group[0].vendorAccountCode,
          payeeName: group[0].vendorDisplayName,
          totalAmountCents,
          paymentMethod: "CHECK",
          bankAccountId,
        })
        .returning();
      newCheckIds.push(check.id);

      await tx.insert(checkLineItems).values(
        group.map((d) => ({
          checkId: check.id,
          contractId: d.contractId,
          amountCents: d.amountCents,
        }))
      );

      await tx
        .update(vendorDisbursements)
        .set({ checkId: check.id })
        .where(inArray(vendorDisbursements.id, group.map((d) => d.id)));
    }
  });

  return newCheckIds;
}
