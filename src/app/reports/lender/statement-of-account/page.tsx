import Link from "next/link";
import { and, eq, gt, gte, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { parties } from "@/db/schema/parties";
import { contracts, contractParties } from "@/db/schema/contracts";
import { formatCents, formatDate, formatPercent } from "@/lib/format";
import { getLenderOptions } from "@/server/lenderReports";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfYearIso(): string {
  return `${new Date().getUTCFullYear()}-01-01`;
}

export async function getStatements(lenderIds: string[], startDate: string, endDate: string) {
  if (lenderIds.length === 0) return [];

  // Current investment portfolio, batched across every selected lender in one
  // query — never one query per lender (see Lender Payment Run for why that
  // matters).
  const portfolioRows = await db
    .select({
      lenderId: contractParties.partyId,
      contractId: contracts.id,
      contractNumber: contracts.contractNumber,
      ownershipPercent: contractParties.ownershipPercent,
      interestRateAnnual: contracts.interestRateAnnual,
      maturityDate: contracts.maturityDate,
      nextPaymentDate: contracts.nextPaymentDate,
      paymentAmountCents: contracts.paymentAmountCents,
      currentPrincipalBalanceCents: contracts.currentPrincipalBalanceCents,
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

  const contractIds = [...new Set(portfolioRows.map((r) => r.contractId))];
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

  // Funding Activity — the schema stores only one fundingDate/fundedAmountCents
  // per contract_parties row (current or historical, closed out via endDate),
  // not a full transaction log of every Closing/Correction/Transfer event the
  // way TMO's own Statement of Account export does. This shows every funding
  // period (current + historical) whose fundingDate falls in the selected
  // range — it will not reflect mid-period corrections/transfers that don't
  // have their own row.
  const fundingRows = await db
    .select({
      lenderId: contractParties.partyId,
      contractId: contracts.id,
      contractNumber: contracts.contractNumber,
      fundingDate: contractParties.fundingDate,
      fundedAmountCents: contractParties.fundedAmountCents,
      interestRateAnnual: contractParties.interestRateAnnual,
    })
    .from(contractParties)
    .innerJoin(contracts, eq(contractParties.contractId, contracts.id))
    .where(
      and(
        inArray(contractParties.partyId, lenderIds),
        eq(contractParties.role, "INVESTOR_PAYEE"),
        gte(contractParties.fundingDate, startDate),
        lte(contractParties.fundingDate, endDate)
      )
    )
    .orderBy(contractParties.fundingDate);

  return lenderIds
    .map((lenderId) => {
      const portfolio = portfolioRows
        .filter((r) => r.lenderId === lenderId)
        .map((r) => ({ ...r, borrowerName: borrowerByContract.get(r.contractId) ?? "—" }));
      const funding = fundingRows.filter((r) => r.lenderId === lenderId);

      const portfolioBalanceCents = portfolio.reduce((s, r) => s + r.currentPrincipalBalanceCents, 0);
      const yieldWeightedSum = portfolio.reduce((s, r) => s + Number(r.interestRateAnnual) * r.currentPrincipalBalanceCents, 0);
      const portfolioYield = portfolioBalanceCents > 0 ? yieldWeightedSum / portfolioBalanceCents : null;
      const fundingTotalCents = funding.reduce((s, r) => s + (r.fundedAmountCents ?? 0), 0);

      return { lenderId, portfolio, portfolioBalanceCents, portfolioYield, funding, fundingTotalCents };
    });
}

export default async function LenderStatementOfAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ lenderIds?: string | string[]; all?: string; startDate?: string; endDate?: string }>;
}) {
  const params = await searchParams;
  const startDate = params.startDate || startOfYearIso();
  const endDate = params.endDate || todayIso();

  const lenderOptions = await getLenderOptions();
  const rawSelected = params.lenderIds
    ? Array.isArray(params.lenderIds)
      ? params.lenderIds
      : [params.lenderIds]
    : [];
  const selectedIds = params.all === "1" ? lenderOptions.map((l) => l.id) : rawSelected;
  const lendersById = new Map(lenderOptions.map((l) => [l.id, l.displayName]));

  const statements = await getStatements(selectedIds, startDate, endDate);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <Link href="/reports/lender" className="text-sm font-medium text-blue-700 hover:underline">
        ← Lender Reports
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold text-slate-900">Statement of Account</h1>
      <p className="mb-6 text-sm text-slate-500">Portfolio balance, investment portfolio, and funding activity for one or more lenders.</p>

      <form method="get" className="mb-8 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="startDate">
              Start Date
            </label>
            <input
              id="startDate"
              type="date"
              name="startDate"
              defaultValue={startDate}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="endDate">
              End Date
            </label>
            <input
              id="endDate"
              type="date"
              name="endDate"
              defaultValue={endDate}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
            Run Report
          </button>
        </div>

        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" name="all" value="1" defaultChecked={params.all === "1"} />
          All Lenders
        </label>

        <div className="grid max-h-56 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto rounded-md border border-slate-200 p-3 sm:grid-cols-3">
          {lenderOptions.map((l) => (
            <label key={l.id} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="lenderIds" value={l.id} defaultChecked={rawSelected.includes(l.id)} />
              {l.displayName}
            </label>
          ))}
        </div>
      </form>

      {selectedIds.length === 0 ? (
        <p className="text-sm text-slate-400">Select one or more lenders (or "All Lenders") and click Run Report.</p>
      ) : (
        <div className="space-y-8">
          <a
            href={`/reports/lender/statement-of-account/export?${new URLSearchParams([
              ...selectedIds.map((id) => ["lenderIds", id] as [string, string]),
              ["startDate", startDate],
              ["endDate", endDate],
            ]).toString()}`}
            className="inline-block rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Download Excel
          </a>
          {statements.map((s) => (
            <section key={s.lenderId} className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h2 className="text-lg font-semibold text-slate-900">{lendersById.get(s.lenderId) ?? "Unknown Lender"}</h2>
                <div className="mt-1 flex gap-6 text-sm text-slate-600">
                  <span>
                    Portfolio Balance: <span className="font-medium text-slate-900">{formatCents(s.portfolioBalanceCents)}</span>
                  </span>
                  <span>
                    Portfolio Yield: <span className="font-medium text-slate-900">{formatPercent(s.portfolioYield)}</span>
                  </span>
                </div>
              </div>

              <div className="p-4">
                <h3 className="mb-2 text-sm font-semibold text-slate-700">Investment Portfolio</h3>
                {s.portfolio.length === 0 ? (
                  <p className="mb-4 text-sm text-slate-400">No current holdings.</p>
                ) : (
                  <div className="mb-6 overflow-x-auto">
                    <table className="w-full min-w-[800px] text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2">Land Contract</th>
                          <th className="px-3 py-2">Borrower</th>
                          <th className="px-3 py-2 text-right">Ownership %</th>
                          <th className="px-3 py-2 text-right">Rate</th>
                          <th className="px-3 py-2">Maturity Date</th>
                          <th className="px-3 py-2">Next Payment</th>
                          <th className="px-3 py-2 text-right">Regular Payment</th>
                          <th className="px-3 py-2 text-right">Loan Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {s.portfolio.map((p) => (
                          <tr key={p.contractId}>
                            <td className="px-3 py-2">
                              <Link href={`/contracts/${p.contractId}`} prefetch={false} className="text-blue-700 hover:underline">
                                {p.contractNumber}
                              </Link>
                            </td>
                            <td className="px-3 py-2">{p.borrowerName}</td>
                            <td className="px-3 py-2 text-right">{formatPercent(p.ownershipPercent)}</td>
                            <td className="px-3 py-2 text-right">{formatPercent(p.interestRateAnnual)}</td>
                            <td className="px-3 py-2">{formatDate(p.maturityDate)}</td>
                            <td className="px-3 py-2">{formatDate(p.nextPaymentDate)}</td>
                            <td className="px-3 py-2 text-right">{formatCents(p.paymentAmountCents)}</td>
                            <td className="px-3 py-2 text-right">{formatCents(p.currentPrincipalBalanceCents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <h3 className="mb-2 text-sm font-semibold text-slate-700">
                  Funding Activity ({formatDate(startDate)} – {formatDate(endDate)})
                </h3>
                {s.funding.length === 0 ? (
                  <p className="text-sm text-slate-400">No funding activity in this date range.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px] text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Land Contract</th>
                          <th className="px-3 py-2 text-right">Rate</th>
                          <th className="px-3 py-2 text-right">Amount Funded</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {s.funding.map((f, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2">{formatDate(f.fundingDate)}</td>
                            <td className="px-3 py-2">
                              <Link href={`/contracts/${f.contractId}`} prefetch={false} className="text-blue-700 hover:underline">
                                {f.contractNumber}
                              </Link>
                            </td>
                            <td className="px-3 py-2 text-right">{formatPercent(f.interestRateAnnual)}</td>
                            <td className="px-3 py-2 text-right">{formatCents(f.fundedAmountCents)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200 font-medium">
                          <td className="px-3 py-2" colSpan={3}>
                            Total
                          </td>
                          <td className="px-3 py-2 text-right">{formatCents(s.fundingTotalCents)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
