import { eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { vendors, vendorDisbursements } from "@/db/schema/vendors";
import { trustLedgerEntries, voucherTypeEnum } from "@/db/schema/escrow";
import { contractCharges } from "@/db/schema/charges";
import { contracts } from "@/db/schema/contracts";
import { properties } from "@/db/schema/parties";
import { paymentMethodEnum } from "@/db/schema/payments";
import { classifyDisbursement, type DisbursementKind } from "@/domain/escrow/classifyDisbursement";
import { debitActiveLenders, type Tx } from "./lenderLedger";

// Keeps a property's Tax/Insurance "last bill" fields current whenever a
// vendor invoice against it is posted — OTHER-classified invoices aren't
// tied to a specific slot and are skipped; TAX invoices use whichever
// winter/summer slot is stalest. No calendar-month guessing: municipality
// billing months vary, so this just self-corrects as real bills arrive.
async function updatePropertyLastBillFields(
  tx: Tx,
  propertyId: string,
  kind: DisbursementKind,
  amountCents: number,
  billDate: string
): Promise<void> {
  if (kind === "OTHER") return;

  if (kind === "INSURANCE") {
    await tx
      .update(properties)
      .set({ insuranceLastBillAmountCents: amountCents, insuranceLastBillDate: billDate })
      .where(eq(properties.id, propertyId));
    return;
  }

  const [property] = await tx
    .select({ winterTaxLastBillDate: properties.winterTaxLastBillDate, summerTaxLastBillDate: properties.summerTaxLastBillDate })
    .from(properties)
    .where(eq(properties.id, propertyId));
  if (!property) return;

  const updateWinter = !property.winterTaxLastBillDate || property.winterTaxLastBillDate <= (property.summerTaxLastBillDate ?? "");
  await tx
    .update(properties)
    .set(
      updateWinter
        ? { winterTaxLastBillAmountCents: amountCents, winterTaxLastBillDate: billDate }
        : { summerTaxLastBillAmountCents: amountCents, summerTaxLastBillDate: billDate }
    )
    .where(eq(properties.id, propertyId));
}

const KIND_TO_VOUCHER_TYPE: Record<string, (typeof voucherTypeEnum.enumValues)[number]> = {
  TAX: "PROPERTY_TAX",
  INSURANCE: "HOMEOWNERS_INSURANCE",
  OTHER: "OTHER",
};

export interface CreateVendorInvoiceInput {
  vendorId: string;
  contractId: string;
  amountCents: number;
  dueDate: string;
  reference: string | null;
  glCode: string | null;
  paymentMethod: (typeof paymentMethodEnum.enumValues)[number] | null;
  // ESCROW (default): deducted from the contract's escrow/trust balance, as
  // before. CHARGE_LENDER: the vendor is still paid and recorded the same
  // way, but instead of touching escrow, the amount becomes a borrower-owed
  // charge (contract_charges) and immediately debits the contract's current
  // lender(s) — who are credited back as the borrower repays it via "Pay
  // Charges" on a regular payment (see server/payments.ts).
  applyMode?: "ESCROW" | "CHARGE_LENDER";
}

// Manually-keyed vendor invoice (New Invoice form) — immediately posted, no
// pending/unpaid state exists in this domain model yet. Mirrors what the TMO
// import produces for a real vendor payment: one row in the vendor's own
// disbursement ledger, and one matching row in the contract's trust/escrow
// ledger so both pages agree, exactly like the historical import did.
export async function createVendorInvoice(input: CreateVendorInvoiceInput): Promise<void> {
  const { vendorId, contractId, amountCents, dueDate, reference, glCode, paymentMethod, applyMode = "ESCROW" } = input;

  const [vendor] = await db.select({ displayName: vendors.displayName }).from(vendors).where(eq(vendors.id, vendorId));
  if (!vendor) throw new Error("Vendor not found.");

  const description = glCode ? `Vendor Invoice (${glCode})` : "Vendor Invoice";
  const kind = classifyDisbursement(description, vendor.displayName);

  if (applyMode === "CHARGE_LENDER") {
    const [contract] = await db
      .select({ contractNumber: contracts.contractNumber, propertyId: contracts.propertyId })
      .from(contracts)
      .where(eq(contracts.id, contractId));
    if (!contract) throw new Error("Contract not found.");

    await db.transaction(async (tx) => {
      await tx
        .insert(vendorDisbursements)
        .values({ vendorId, contractId, transactionDate: dueDate, reference, amountCents, glCode, paymentMethod });

      await tx.insert(contractCharges).values({
        contractId,
        description: `${vendor.displayName}${glCode ? ` (${glCode})` : ""}`,
        chargeDate: dueDate,
        amountCents,
        remainingCents: amountCents,
        vendorId,
      });

      await debitActiveLenders(tx, contractId, amountCents, dueDate, `Charge: ${vendor.displayName} — ${contract.contractNumber}`);
      await updatePropertyLastBillFields(tx, contract.propertyId, kind, amountCents, dueDate);
    });
    return;
  }

  const [contract] = await db.select({ propertyId: contracts.propertyId }).from(contracts).where(eq(contracts.id, contractId));
  if (!contract) throw new Error("Contract not found.");

  const [latestEntry] = await db
    .select({ balanceCents: trustLedgerEntries.balanceCents })
    .from(trustLedgerEntries)
    .where(eq(trustLedgerEntries.contractId, contractId))
    .orderBy(desc(trustLedgerEntries.transactionDate), desc(trustLedgerEntries.id))
    .limit(1);
  const priorBalanceCents = latestEntry?.balanceCents ?? 0;

  await db.transaction(async (tx) => {
    await tx.insert(vendorDisbursements).values({
      vendorId,
      contractId,
      transactionDate: dueDate,
      reference,
      amountCents,
      glCode,
      paymentMethod,
    });

    await tx.insert(trustLedgerEntries).values({
      contractId,
      transactionDate: dueDate,
      reference,
      payeeOrPayerName: vendor.displayName,
      description,
      amountPaidOutCents: amountCents,
      balanceCents: priorBalanceCents - amountCents,
      category: "IMPOUND",
      voucherType: KIND_TO_VOUCHER_TYPE[kind],
    });

    await updatePropertyLastBillFields(tx, contract.propertyId, kind, amountCents, dueDate);
  });
}

function generateVendorAccountCode(displayName: string): string {
  const base = displayName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
  return base || "VENDOR";
}

export async function createVendor(displayName: string): Promise<string> {
  const base = generateVendorAccountCode(displayName);
  let code = base;
  let suffix = 1;
  // Extremely unlikely to loop more than once or twice in practice — account
  // codes only collide when two vendors share the same first ~10 letters.
  while (await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.vendorAccountCode, code)).then((r) => r.length > 0)) {
    suffix++;
    code = `${base}${suffix}`;
  }

  const [vendor] = await db.insert(vendors).values({ vendorAccountCode: code, displayName }).returning();
  return vendor.id;
}
