import Link from "next/link";
import CategoryTabs from "../../../_components/CategoryTabs";
import ReportActionBar from "../../_components/ReportActionBar";
import { getLenderOptions, getPortfolioChargesData } from "@/server/lenderReports";
import { formatCents, formatDate } from "@/lib/format";
import { emailPortfolioChargesAction, postPortfolioChargesAction } from "./actions";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfYearIso(): string {
  return `${new Date().getUTCFullYear()}-01-01`;
}

export default async function PortfolioChargesPage({
  searchParams,
}: {
  searchParams: Promise<{ lenderIds?: string | string[]; all?: string; startDate?: string; endDate?: string }>;
}) {
  const params = await searchParams;
  const startDate = params.startDate || startOfYearIso();
  const endDate = params.endDate || todayIso();

  const lenderOptions = await getLenderOptions();
  const lendersById = new Map(lenderOptions.map((l) => [l.id, l]));
  const rawSelected = params.lenderIds ? (Array.isArray(params.lenderIds) ? params.lenderIds : [params.lenderIds]) : [];
  const selectedIds = params.all === "1" ? lenderOptions.map((l) => l.id) : rawSelected;

  const statements = selectedIds.length > 0 ? await getPortfolioChargesData(selectedIds, startDate, endDate) : [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/reports/lender" className="text-sm font-medium text-blue-700 hover:underline print:hidden">
        ← Lender Reports
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold text-slate-900 print:hidden">Portfolio Charges Report</h1>
      <p className="mb-4 text-sm text-slate-500 print:hidden">
        Charges/advances posted against a lender's funded contracts over a date range, with whether each was also charged
        to the borrower.
      </p>
      <div className="print:hidden">
        <CategoryTabs basePath="/reports" />
      </div>

      <form method="get" className="mb-8 rounded-lg border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="startDate">
              Start Date
            </label>
            <input id="startDate" type="date" name="startDate" defaultValue={startDate} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="endDate">
              End Date
            </label>
            <input id="endDate" type="date" name="endDate" defaultValue={endDate} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
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
          {statements.map((data) => (
            <section key={data.lenderId} className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="p-4">
                <ReportActionBar
                  excelHref={`/reports/lender/portfolio-charges/export?lenderIds=${data.lenderId}&startDate=${startDate}&endDate=${endDate}`}
                  onEmail={emailPortfolioChargesAction.bind(null, data.lenderId, startDate, endDate)}
                  onPost={postPortfolioChargesAction.bind(null, data.lenderId, startDate, endDate)}
                  postLabel="Post to Lender Portal"
                />

                <h2 className="text-lg font-semibold text-slate-900">
                  Portfolio Charges — {lendersById.get(data.lenderId)?.displayName ?? "Unknown Lender"}
                </h2>
                <p className="mb-4 text-sm text-slate-500">
                  {formatDate(startDate)} – {formatDate(endDate)}
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Land Contract</th>
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2">Also Charged to Borrower</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.rows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                            No charges in this range.
                          </td>
                        </tr>
                      ) : (
                        data.rows.map((r, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2">{formatDate(r.transactionDate)}</td>
                            <td className="px-3 py-2">{r.contractNumber ?? "—"}</td>
                            <td className="px-3 py-2">{r.description ?? "—"}</td>
                            <td className="px-3 py-2 text-right">{formatCents(r.amountPaidOutCents)}</td>
                            <td className="px-3 py-2">
                              {r.alsoChargedToBorrower ? (
                                <span className="text-amber-700">Yes ({formatCents(r.borrowerRemainingCents)} remaining)</span>
                              ) : (
                                <span className="text-slate-400">No</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 font-medium">
                        <td className="px-3 py-2" colSpan={3}>
                          Total
                        </td>
                        <td className="px-3 py-2 text-right">{formatCents(data.totalChargesCents)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
