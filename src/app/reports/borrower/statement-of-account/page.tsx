import Link from "next/link";
import CategoryTabs from "../../../_components/CategoryTabs";
import ReportActionBar from "../../_components/ReportActionBar";
import { getBorrowerContractOptions, getStatementsOfAccount } from "@/server/borrowerReports";
import { formatCents, formatDate, formatPercent } from "@/lib/format";
import { emailStatementAction, postStatementAction } from "./actions";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfYearIso(): string {
  return `${new Date().getUTCFullYear()}-01-01`;
}

export default async function BorrowerStatementOfAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ contractIds?: string | string[]; all?: string; startDate?: string; endDate?: string; showPaidOff?: string }>;
}) {
  const params = await searchParams;
  const startDate = params.startDate || startOfYearIso();
  const endDate = params.endDate || todayIso();
  const showPaidOff = params.showPaidOff === "1";

  const contractOptions = await getBorrowerContractOptions(showPaidOff);
  const optionsById = new Map(contractOptions.map((c) => [c.id, c]));
  const rawSelected = params.contractIds ? (Array.isArray(params.contractIds) ? params.contractIds : [params.contractIds]) : [];
  const selectedIds = params.all === "1" ? contractOptions.map((c) => c.id) : rawSelected;

  const statements = selectedIds.length > 0 ? await getStatementsOfAccount(selectedIds, startDate, endDate) : [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/reports/borrower" className="text-sm font-medium text-blue-700 hover:underline print:hidden">
        ← Borrower Reports
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold text-slate-900 print:hidden">Statement of Account</h1>
      <p className="mb-4 text-sm text-slate-500 print:hidden">Portfolio balance and payment history for one or more borrowers over a date range.</p>
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

        <div className="mb-2 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" name="all" value="1" defaultChecked={params.all === "1"} />
            All Borrowers
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-500">
            <input type="checkbox" name="showPaidOff" value="1" defaultChecked={showPaidOff} />
            Show Paid Off
          </label>
        </div>

        <div className="grid max-h-56 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto rounded-md border border-slate-200 p-3 sm:grid-cols-3">
          {contractOptions.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="contractIds" value={c.id} defaultChecked={rawSelected.includes(c.id)} />
              {c.label}
            </label>
          ))}
        </div>
      </form>

      {selectedIds.length === 0 ? (
        <p className="text-sm text-slate-400">Select one or more borrowers (or "All Borrowers") and click Run Report.</p>
      ) : (
        <div className="space-y-8">
          {statements.map((data) => {
            const selected = optionsById.get(data.contractId);
            return (
              <section key={data.contractId} className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="p-4">
                  <ReportActionBar
                    excelHref={`/reports/borrower/statement-of-account/export?contractId=${data.contractId}&startDate=${startDate}&endDate=${endDate}`}
                    defaultRecipientEmail={selected?.buyerEmail ?? selected?.borrowerPortalEmail ?? ""}
                    onEmail={emailStatementAction.bind(null, data.contractId, startDate, endDate)}
                    onPost={postStatementAction.bind(null, data.contractId, startDate, endDate)}
                  />

                  <h2 className="text-lg font-semibold text-slate-900">Statement of Account — {data.contractNumber}</h2>
                  <p className="mb-4 text-sm text-slate-500">
                    {data.borrowerName}
                    <br />
                    {data.propertyAddress}
                  </p>

                  <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Principal Balance</div>
                      <div className="text-sm font-medium text-slate-900">{formatCents(data.currentPrincipalBalanceCents)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Interest Rate</div>
                      <div className="text-sm font-medium text-slate-900">{formatPercent(data.interestRateAnnual)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Next Payment Date</div>
                      <div className="text-sm font-medium text-slate-900">{formatDate(data.nextPaymentDate)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Maturity Date</div>
                      <div className="text-sm font-medium text-slate-900">{formatDate(data.maturityDate)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Regular Payment</div>
                      <div className="text-sm font-medium text-slate-900">{formatCents(data.paymentAmountCents)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Escrow Balance</div>
                      <div className="text-sm font-medium text-slate-900">{formatCents(data.escrowBalanceCents)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reserve Balance</div>
                      <div className="text-sm font-medium text-slate-900">{formatCents(data.reserveBalanceCents)}</div>
                    </div>
                  </div>

                  <h3 className="mb-2 text-sm font-semibold text-slate-700">
                    Payment History ({formatDate(startDate)} – {formatDate(endDate)})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px] text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Due Date (est.)</th>
                          <th className="px-3 py-2">Method</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.paymentHistory.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                              No payments in this range.
                            </td>
                          </tr>
                        ) : (
                          data.paymentHistory.map((p, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2">{formatDate(p.receivedDate)}</td>
                              <td className="px-3 py-2 text-slate-500">{p.dueDate ? formatDate(p.dueDate) : "—"}</td>
                              <td className="px-3 py-2">{p.paymentMethod}</td>
                              <td className="px-3 py-2 text-right">{formatCents(p.amountCents)}</td>
                              <td className="px-3 py-2">{p.status}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
