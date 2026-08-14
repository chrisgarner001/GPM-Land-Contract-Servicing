import { eq, desc, and, isNotNull, isNull, gt } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts } from "@/db/schema/contracts";
import { payments, paymentAllocations } from "@/db/schema/payments";
import { trustLedgerEntries, escrowAnalyses } from "@/db/schema/escrow";
import { classifyDisbursement } from "@/domain/escrow/classifyDisbursement";
import { formatCents, formatDate } from "@/lib/format";
import RunAnalysisForm from "./_components/RunAnalysisForm";

const TRIGGER_LABELS: Record<string, string> = {
  SEMI_ANNUAL_SCHEDULED: "Semi-Annual Scheduled Review",
  LARGE_BILL_RECEIVED: "Unexpected Large Bill Received",
  ONBOARDING: "Onboarding",
  MANUAL: "Manual",
};

function centsToDollarsString(cents: number): string {
  return (cents / 100).toFixed(2);
}

export default async function EscrowAnalysisPage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params;
  const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!contract) return null;

  const disbursements = await db
    .select()
    .from(trustLedgerEntries)
    .where(and(eq(trustLedgerEntries.contractId, contractId), isNotNull(trustLedgerEntries.amountPaidOutCents)))
    .orderBy(desc(trustLedgerEntries.transactionDate));

  const classified = disbursements.map((d) => ({ ...d, kind: classifyDisbursement(d.description, d.payeeOrPayerName) }));
  const mostRecentDate = classified[0]?.transactionDate ?? null;
  const oneYearAgo = mostRecentDate
    ? new Date(new Date(`${mostRecentDate}T00:00:00Z`).getTime() - 365 * 86_400_000)
    : null;

  const trailing12mo = oneYearAgo ? classified.filter((d) => new Date(`${d.transactionDate}T00:00:00Z`) >= oneYearAgo) : [];
  const trailingTaxCents = trailing12mo.filter((d) => d.kind === "TAX").reduce((s, d) => s + (d.amountPaidOutCents ?? 0), 0);
  const trailingInsuranceCents = trailing12mo
    .filter((d) => d.kind === "INSURANCE")
    .reduce((s, d) => s + (d.amountPaidOutCents ?? 0), 0);

  const recentTax = classified.filter((d) => d.kind === "TAX").slice(0, 4);
  const recentInsurance = classified.filter((d) => d.kind === "INSURANCE").slice(0, 4);

  // id is a tiebreaker only, not a meaningful sequence — trust_ledger_entries
  // has no real ordering column for same-day rows (see Escrow Maintenance
  // page comment), but ties still need to resolve the same way everywhere
  // this value is read, or different pages disagree on the same contract.
  const [latestTrustEntry] = await db
    .select({ balanceCents: trustLedgerEntries.balanceCents })
    .from(trustLedgerEntries)
    .where(eq(trustLedgerEntries.contractId, contractId))
    .orderBy(desc(trustLedgerEntries.transactionDate), desc(trustLedgerEntries.id))
    .limit(1);

  const [latestEscrowPayment] = await db
    .select({ amountCents: paymentAllocations.amountCents, receivedDate: payments.receivedDate })
    .from(paymentAllocations)
    .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
    .where(
      and(
        eq(payments.contractId, contractId),
        eq(paymentAllocations.allocationType, "ESCROW_TAX"),
        eq(payments.status, "CLEARED"),
        // Excludes reversal offset entries — those are stored as CLEARED too,
        // but carry a negated allocation, which would otherwise get picked up
        // here as if it were the real current escrow portion.
        isNull(payments.reversedPaymentId),
        // Also excludes $0 LEGACY_IMPORT "IMPOUND CLEAR" wash entries and
        // payoff payments that refund the escrow balance (both carry a
        // zero/negative allocation here) — neither is a real recurring
        // monthly collection. Confirmed against real data these are common
        // enough (over half of all contracts) to corrupt this value if not
        // filtered.
        gt(paymentAllocations.amountCents, 0)
      )
    )
    .orderBy(desc(payments.receivedDate), desc(payments.createdAt))
    .limit(1);

  const pastAnalyses = await db
    .select()
    .from(escrowAnalyses)
    .where(eq(escrowAnalyses.contractId, contractId))
    .orderBy(desc(escrowAnalyses.analysisDate));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 shadow-sm p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Current Tax Payments</h3>
          <p className="mb-2 text-sm text-slate-500">
            Trailing 12 months: <span className="font-medium text-slate-900">{formatCents(trailingTaxCents)}</span>
          </p>
          {recentTax.length === 0 ? (
            <p className="text-sm text-slate-400">No tax disbursements found.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {recentTax.map((d) => (
                <li key={d.id} className="flex items-baseline justify-between">
                  <span className="text-slate-500">{formatDate(d.transactionDate)}</span>
                  <span className="tabular-nums text-slate-900">{formatCents(d.amountPaidOutCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 shadow-sm p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Current Insurance Payments</h3>
          <p className="mb-2 text-sm text-slate-500">
            Trailing 12 months: <span className="font-medium text-slate-900">{formatCents(trailingInsuranceCents)}</span>
          </p>
          {recentInsurance.length === 0 ? (
            <p className="text-sm text-slate-400">No insurance disbursements found.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {recentInsurance.map((d) => (
                <li key={d.id} className="flex items-baseline justify-between">
                  <span className="text-slate-500">{formatDate(d.transactionDate)}</span>
                  <span className="tabular-nums text-slate-900">{formatCents(d.amountPaidOutCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 shadow-sm p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Current Escrow Collection</h3>
          <div className="flex items-baseline justify-between py-1 text-sm">
            <span className="text-slate-500">Monthly Payment</span>
            <span className="font-medium tabular-nums text-slate-900">
              {latestEscrowPayment ? formatCents(latestEscrowPayment.amountCents) : "—"}
            </span>
          </div>
          <div className="flex items-baseline justify-between py-1 text-sm">
            <span className="text-slate-500">Current Balance</span>
            <span className="font-medium tabular-nums text-slate-900">
              {latestTrustEntry ? formatCents(latestTrustEntry.balanceCents) : "—"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Per the land contract, this stays fixed until an analysis is run — twice a year after the semi-annual tax
            payments, or sooner if an unexpected bill arrives.
          </p>
        </div>
      </div>

      <RunAnalysisForm
        contractId={contractId}
        defaultProjectedAnnualTaxDollars={centsToDollarsString(trailingTaxCents)}
        defaultProjectedAnnualInsuranceDollars={centsToDollarsString(trailingInsuranceCents)}
        defaultCurrentEscrowBalanceDollars={centsToDollarsString(latestTrustEntry?.balanceCents ?? 0)}
        defaultCurrentMonthlyEscrowPaymentDollars={centsToDollarsString(latestEscrowPayment?.amountCents ?? 0)}
      />

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Past Analyses</h3>
        {pastAnalyses.length === 0 ? (
          <p className="text-sm text-slate-400">No analyses run yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2 text-right">Projected Annual (Tax + Ins.)</th>
                  <th className="px-3 py-2 text-right">Cushion Target</th>
                  <th className="px-3 py-2 text-right">Projected Ending Balance</th>
                  <th className="px-3 py-2 text-right">Shortage / Surplus</th>
                  <th className="px-3 py-2 text-right">New Monthly Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pastAnalyses.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-1.5 text-slate-600">{formatDate(a.analysisDate)}</td>
                    <td className="px-3 py-1.5 text-slate-600">{TRIGGER_LABELS[a.trigger] ?? a.trigger}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                      {formatCents(a.projectedAnnualTaxCents + a.projectedAnnualInsuranceCents)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{formatCents(a.cushionTargetCents)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                      {formatCents(a.projectedEndingBalanceCents)}
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right tabular-nums font-medium ${
                        a.shortageOrSurplusCents > 0 ? "text-red-700" : "text-emerald-700"
                      }`}
                    >
                      {a.shortageOrSurplusCents > 0 ? "Shortage " : "Surplus "}
                      {formatCents(Math.abs(a.shortageOrSurplusCents))}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium text-slate-900">
                      {formatCents(a.newMonthlyEscrowPaymentCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
