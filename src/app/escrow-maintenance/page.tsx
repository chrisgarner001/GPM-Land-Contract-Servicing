import Link from "next/link";
import { PiggyBank } from "lucide-react";
import { eq, and, inArray, isNotNull, isNull, gt, desc, sum } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts, contractParties } from "@/db/schema/contracts";
import { parties } from "@/db/schema/parties";
import { payments, paymentAllocations } from "@/db/schema/payments";
import { trustLedgerEntries } from "@/db/schema/escrow";
import { classifyDisbursement } from "@/domain/escrow/classifyDisbursement";
import { runEscrowAnalysis } from "@/domain/escrow/runEscrowAnalysis";
import { formatCents } from "@/lib/format";

interface EscrowRow {
  contractId: string;
  contractNumber: string;
  buyerName: string | null;
  escrowBalanceCents: number | null;
  reserveBalanceCents: number;
  monthlyPaymentCents: number;
  projectedAnnualTaxCents: number;
  projectedAnnualInsuranceCents: number;
  shortageOrSurplusCents: number;
}

async function getEscrowMaintenanceRows(): Promise<EscrowRow[]> {
  const activeContracts = await db
    .select({ id: contracts.id, contractNumber: contracts.contractNumber })
    .from(contracts)
    .where(eq(contracts.status, "ACTIVE"));
  const activeIds = activeContracts.map((c) => c.id);
  if (activeIds.length === 0) return [];

  const buyerRows = await db
    .select({ contractId: contractParties.contractId, buyerName: parties.displayName })
    .from(contractParties)
    .innerJoin(parties, eq(contractParties.partyId, parties.id))
    .where(and(inArray(contractParties.contractId, activeIds), eq(contractParties.role, "BUYER")));
  const buyerByContract = new Map<string, string>();
  for (const b of buyerRows) {
    if (!buyerByContract.has(b.contractId)) buyerByContract.set(b.contractId, b.buyerName);
  }

  // Reserve balance per contract — running sum of SUSPENSE allocations.
  const reserveRows = await db
    .select({ contractId: payments.contractId, total: sum(paymentAllocations.amountCents) })
    .from(paymentAllocations)
    .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
    .where(and(inArray(payments.contractId, activeIds), eq(paymentAllocations.allocationType, "SUSPENSE")))
    .groupBy(payments.contractId);
  const reserveByContract = new Map(reserveRows.map((r) => [r.contractId, Number(r.total ?? 0)]));

  // Current monthly escrow payment per contract — most recent CLEARED,
  // non-reversal, POSITIVE ESCROW_TAX allocation (same rule as the LC detail
  // page and per-contract Escrow Analysis page). The positive-amount filter
  // is required: confirmed against real data that many contracts' most
  // recent escrow-tagged row is either a $0 LEGACY_IMPORT "IMPOUND CLEAR"
  // wash/reclassification entry from the TMO migration, or a payoff payment
  // that refunds the remaining escrow balance back to the borrower (a large
  // negative allocation) — neither represents a real recurring monthly
  // collection, and picking them up here produced negative "Monthly Payment"
  // values that corrupted the shortage/surplus projection.
  const escrowPaymentRows = await db
    .selectDistinctOn([payments.contractId], {
      contractId: payments.contractId,
      amountCents: paymentAllocations.amountCents,
    })
    .from(paymentAllocations)
    .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
    .where(
      and(
        inArray(payments.contractId, activeIds),
        eq(paymentAllocations.allocationType, "ESCROW_TAX"),
        eq(payments.status, "CLEARED"),
        isNull(payments.reversedPaymentId),
        gt(paymentAllocations.amountCents, 0)
      )
    )
    .orderBy(payments.contractId, desc(payments.receivedDate), desc(payments.createdAt));
  const monthlyPaymentByContract = new Map(escrowPaymentRows.map((r) => [r.contractId, r.amountCents]));

  // Latest impound/escrow balance per contract — TMO's own authoritative
  // running balance (see LC detail page comment on why this isn't derived).
  // id is a tiebreaker only, not a meaningful sequence — trust_ledger_entries
  // has no real ordering column for same-day rows, but ties still need to
  // resolve the same way everywhere this value is read (LC detail page and
  // per-contract Escrow Analysis use the identical tiebreaker).
  const balanceRows = await db
    .selectDistinctOn([trustLedgerEntries.contractId], {
      contractId: trustLedgerEntries.contractId,
      balanceCents: trustLedgerEntries.balanceCents,
    })
    .from(trustLedgerEntries)
    .where(inArray(trustLedgerEntries.contractId, activeIds))
    .orderBy(trustLedgerEntries.contractId, desc(trustLedgerEntries.transactionDate), desc(trustLedgerEntries.id));
  const balanceByContract = new Map(balanceRows.map((r) => [r.contractId, r.balanceCents]));

  // All disbursements for active contracts, classified and grouped so each
  // contract's trailing-12-month tax/insurance total is anchored to its own
  // most recent disbursement date (not "today" — historical demo/import
  // dates don't align with the real calendar).
  const disbursements = await db
    .select({
      contractId: trustLedgerEntries.contractId,
      transactionDate: trustLedgerEntries.transactionDate,
      description: trustLedgerEntries.description,
      payeeOrPayerName: trustLedgerEntries.payeeOrPayerName,
      amountPaidOutCents: trustLedgerEntries.amountPaidOutCents,
    })
    .from(trustLedgerEntries)
    .where(and(inArray(trustLedgerEntries.contractId, activeIds), isNotNull(trustLedgerEntries.amountPaidOutCents)));

  const disbursementsByContract = new Map<string, typeof disbursements>();
  for (const d of disbursements) {
    const list = disbursementsByContract.get(d.contractId) ?? [];
    list.push(d);
    disbursementsByContract.set(d.contractId, list);
  }

  return activeContracts.map((c) => {
    const contractDisbursements = disbursementsByContract.get(c.id) ?? [];
    const mostRecentDate = contractDisbursements.reduce<string | null>(
      (latest, d) => (!latest || d.transactionDate > latest ? d.transactionDate : latest),
      null
    );
    const oneYearAgo = mostRecentDate
      ? new Date(new Date(`${mostRecentDate}T00:00:00Z`).getTime() - 365 * 86_400_000)
      : null;
    const trailing12mo = oneYearAgo
      ? contractDisbursements.filter((d) => new Date(`${d.transactionDate}T00:00:00Z`) >= oneYearAgo)
      : [];

    const projectedAnnualTaxCents = trailing12mo
      .filter((d) => classifyDisbursement(d.description, d.payeeOrPayerName) === "TAX")
      .reduce((s, d) => s + (d.amountPaidOutCents ?? 0), 0);
    const projectedAnnualInsuranceCents = trailing12mo
      .filter((d) => classifyDisbursement(d.description, d.payeeOrPayerName) === "INSURANCE")
      .reduce((s, d) => s + (d.amountPaidOutCents ?? 0), 0);

    const escrowBalanceCents = balanceByContract.get(c.id) ?? null;
    const monthlyPaymentCents = monthlyPaymentByContract.get(c.id) ?? 0;

    const { shortageOrSurplusCents } = runEscrowAnalysis({
      currentEscrowBalanceCents: escrowBalanceCents ?? 0,
      currentMonthlyEscrowPaymentCents: monthlyPaymentCents,
      projectedAnnualTaxCents,
      projectedAnnualInsuranceCents,
    });

    return {
      contractId: c.id,
      contractNumber: c.contractNumber,
      buyerName: buyerByContract.get(c.id) ?? null,
      escrowBalanceCents,
      reserveBalanceCents: reserveByContract.get(c.id) ?? 0,
      monthlyPaymentCents,
      projectedAnnualTaxCents,
      projectedAnnualInsuranceCents,
      shortageOrSurplusCents,
    };
  });
}

export default async function EscrowMaintenancePage() {
  const rows = await getEscrowMaintenanceRows();
  rows.sort((a, b) => a.contractNumber.localeCompare(b.contractNumber));

  const totalEscrowBalanceCents = rows.reduce((s, r) => s + (r.escrowBalanceCents ?? 0), 0);
  const totalReserveBalanceCents = rows.reduce((s, r) => s + r.reserveBalanceCents, 0);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
        <PiggyBank size={20} className="text-slate-400" aria-hidden="true" />
        Escrow Maintenance
      </h1>
      <p className="mb-4 text-sm text-slate-500">
        {rows.length} active land contracts — projected shortage/surplus based on trailing 12-month tax and insurance
        disbursements against the current monthly escrow payment, targeting a 5% cushion.
      </p>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Escrow Balance</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{formatCents(totalEscrowBalanceCents)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Reserve Balance</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{formatCents(totalReserveBalanceCents)}</p>
        </div>
      </div>

      <div className="max-h-[75vh] overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3">Land Contract</th>
              <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3">Borrower</th>
              <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-right">Escrow Balance</th>
              <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-right">Reserve Balance</th>
              <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-right">Annual Projected Tax</th>
              <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-right">Annual Projected Insurance</th>
              <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-right">Monthly Payment</th>
              <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-right">Projected Shortage / Surplus</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.contractId} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">
                  <Link href={`/contracts/${r.contractId}`} prefetch={false} className="text-blue-700 hover:underline">
                    {r.contractNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{r.buyerName ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatCents(r.escrowBalanceCents)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatCents(r.reserveBalanceCents)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatCents(r.projectedAnnualTaxCents)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {formatCents(r.projectedAnnualInsuranceCents)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatCents(r.monthlyPaymentCents)}</td>
                <td
                  className={`px-4 py-3 text-right tabular-nums font-medium ${
                    r.shortageOrSurplusCents > 0 ? "text-red-700" : "text-emerald-700"
                  }`}
                >
                  {r.shortageOrSurplusCents > 0 ? "Shortage " : "Surplus "}
                  {formatCents(Math.abs(r.shortageOrSurplusCents))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
