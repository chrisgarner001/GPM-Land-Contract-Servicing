import Link from "next/link";
import CategoryTabs from "../../../_components/CategoryTabs";
import ReportActionBar from "../../_components/ReportActionBar";
import { getEquityAnalysis, DEFAULT_EQUITY_THRESHOLD_PERCENT } from "@/server/loanReports";
import { formatCents, formatDate } from "@/lib/format";
import { emailEquityAnalysisAction } from "./actions";

export default async function LoanEquityAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ qualifyingOnly?: string; thresholdPercent?: string; submitted?: string }>;
}) {
  const params = await searchParams;
  // Unchecked checkboxes never appear in a GET form's query string, so a
  // plain "was qualifyingOnly=1 present" check can't tell "first visit"
  // apart from "user explicitly unchecked it and hit Apply" — the hidden
  // `submitted` field disambiguates them.
  const qualifyingOnly = params.submitted ? params.qualifyingOnly === "1" : true;
  const parsedThreshold = Number(params.thresholdPercent);
  const thresholdPercent = Number.isFinite(parsedThreshold) && params.thresholdPercent ? parsedThreshold : DEFAULT_EQUITY_THRESHOLD_PERCENT;

  const allRows = await getEquityAnalysis(thresholdPercent);
  const rows = qualifyingOnly ? allRows.filter((r) => r.qualifies) : allRows;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <Link href="/reports/loan" className="text-sm font-medium text-blue-700 hover:underline print:hidden">
        ← Loan Reports
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold text-slate-900 print:hidden">Land Contract Equity Analysis</h1>
      <p className="mb-4 text-sm text-slate-500 print:hidden">
        Compares each active Land Contract&apos;s balance to the property&apos;s AssessorSearch-estimated market
        value — a refi-marketing candidate list for LC holders with enough estimated equity to likely qualify for a
        conventional refinance.
      </p>
      <div className="print:hidden">
        <CategoryTabs basePath="/reports" />
      </div>

      <ReportActionBar
        excelHref={`/reports/loan/equity-analysis/export?qualifyingOnly=${qualifyingOnly ? "1" : "0"}&thresholdPercent=${thresholdPercent}`}
        onEmail={emailEquityAnalysisAction.bind(null, qualifyingOnly, thresholdPercent)}
      />

      <form method="get" className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <input type="hidden" name="submitted" value="1" />
        <div className="flex items-center gap-2">
          <label htmlFor="thresholdPercent" className="text-sm font-medium text-slate-700">
            Minimum Equity %
          </label>
          <input
            id="thresholdPercent"
            name="thresholdPercent"
            type="number"
            step="0.1"
            min="0"
            max="100"
            defaultValue={thresholdPercent}
            className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" name="qualifyingOnly" value="1" defaultChecked={qualifyingOnly} />
          Only show qualifying (marketing-ready)
        </label>
        <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Apply
        </button>
      </form>

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1200px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Contract #</th>
              <th className="px-4 py-3">Lender</th>
              <th className="px-4 py-3">Borrower</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">County</th>
              <th className="px-4 py-3 text-right">LC Balance</th>
              <th className="px-4 py-3 text-right">Market Value</th>
              <th className="px-4 py-3 text-right">Equity</th>
              <th className="px-4 py-3 text-right">Equity %</th>
              <th className="px-4 py-3">Data As Of</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-6 text-center text-slate-400">
                  {qualifyingOnly ? `No active Land Contracts currently meet the ${thresholdPercent}%+ equity threshold.` : "No active Land Contracts on file."}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.contractId} className={r.qualifies ? "bg-emerald-50/40" : undefined}>
                  <td className="px-4 py-3">
                    <Link href={`/contracts/${r.contractId}`} prefetch={false} className="font-medium text-blue-700 hover:underline">
                      {r.contractNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.lenderName ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.borrowerName ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.borrowerEmail ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.borrowerPhone ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.propertyAddress}</td>
                  <td className="px-4 py-3 text-slate-600">{r.county}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCents(r.currentPrincipalBalanceCents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.estimatedMarketValueCents !== null ? formatCents(r.estimatedMarketValueCents) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.equityCents !== null ? formatCents(r.equityCents) : "—"}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {r.equityPercent !== null ? `${r.equityPercent.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{r.assessorFetchedAt ? formatDate(r.assessorFetchedAt) : "No assessor data"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
