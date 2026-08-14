import { ReceiptText } from "lucide-react";
import { eq, and, gt, isNull, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts, contractParties } from "@/db/schema/contracts";
import { parties } from "@/db/schema/parties";
import { vendors } from "@/db/schema/vendors";
import { trustLedgerEntries } from "@/db/schema/escrow";
import { glCodes } from "@/db/schema/setup";
import NewInvoiceForm from "./_components/NewInvoiceForm";

async function getVendorOptions() {
  return db
    .select({ id: vendors.id, displayName: vendors.displayName, defaultGlCode: vendors.defaultGlCode })
    .from(vendors)
    .orderBy(vendors.displayName);
}

async function getGlCodeOptions() {
  return db
    .select({ code: glCodes.code, description: glCodes.description, type: glCodes.type })
    .from(glCodes)
    .orderBy(glCodes.code);
}

async function getContractOptions() {
  const contractRows = await db
    .select({ id: contracts.id, contractNumber: contracts.contractNumber })
    .from(contracts)
    .orderBy(contracts.contractNumber);

  const buyerRows = await db
    .select({ contractId: contractParties.contractId, buyerName: parties.displayName })
    .from(contractParties)
    .innerJoin(parties, eq(contractParties.partyId, parties.id))
    .where(eq(contractParties.role, "BUYER"));
  const buyerByContract = new Map<string, string>();
  for (const b of buyerRows) {
    if (!buyerByContract.has(b.contractId)) buyerByContract.set(b.contractId, b.buyerName);
  }

  // id is a tiebreaker only — trust_ledger_entries has no reliable ordering
  // column for same-date rows (see Escrow Maintenance page comment); kept
  // consistent with every other query that reads "the current balance."
  const balanceRows = await db
    .selectDistinctOn([trustLedgerEntries.contractId], {
      contractId: trustLedgerEntries.contractId,
      balanceCents: trustLedgerEntries.balanceCents,
    })
    .from(trustLedgerEntries)
    .orderBy(trustLedgerEntries.contractId, desc(trustLedgerEntries.transactionDate), desc(trustLedgerEntries.id));
  const balanceByContract = new Map(balanceRows.map((r) => [r.contractId, r.balanceCents]));

  // Current lender(s) per contract — same filter used everywhere else
  // ("current" = active ownership share, not yet superseded by a later
  // funding) — so New Invoice's Charge Lender mode can show who'd be
  // charged before staff submits.
  const lenderRows = await db
    .select({
      contractId: contractParties.contractId,
      displayName: parties.displayName,
      ownershipPercent: contractParties.ownershipPercent,
    })
    .from(contractParties)
    .innerJoin(parties, eq(contractParties.partyId, parties.id))
    .where(
      and(eq(contractParties.role, "INVESTOR_PAYEE"), gt(contractParties.ownershipPercent, "0"), isNull(contractParties.endDate))
    );
  const lendersByContract = new Map<string, { displayName: string; ownershipPercent: string }[]>();
  for (const l of lenderRows) {
    const list = lendersByContract.get(l.contractId) ?? [];
    list.push({ displayName: l.displayName, ownershipPercent: l.ownershipPercent ?? "0" });
    lendersByContract.set(l.contractId, list);
  }

  return contractRows.map((c) => ({
    id: c.id,
    contractNumber: c.contractNumber,
    buyerName: buyerByContract.get(c.id) ?? null,
    currentEscrowBalanceCents: balanceByContract.get(c.id) ?? 0,
    currentLenders: lendersByContract.get(c.id) ?? [],
  }));
}

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ vendorId?: string }> }) {
  const { vendorId } = await searchParams;
  const [vendorOptions, contractOptions, glCodeOptions] = await Promise.all([
    getVendorOptions(),
    getContractOptions(),
    getGlCodeOptions(),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
        <ReceiptText size={20} className="text-slate-400" aria-hidden="true" />
        New Invoice
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Record a vendor invoice and apply it against a land contract&apos;s escrow balance, or charge it to the
        contract&apos;s current lender.
      </p>

      <NewInvoiceForm
        vendorOptions={vendorOptions}
        contractOptions={contractOptions}
        glCodeOptions={glCodeOptions}
        defaultVendorId={vendorId}
      />
    </main>
  );
}
