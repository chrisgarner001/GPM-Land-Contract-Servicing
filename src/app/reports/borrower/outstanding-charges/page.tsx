import Link from "next/link";
import CategoryTabs from "../../../_components/CategoryTabs";
import ReportActionBar from "../../_components/ReportActionBar";
import { getBorrowerContractOptions, getMultipleOutstandingCharges } from "@/server/borrowerReports";
import { formatCents, formatDate } from "@/lib/format";
import { emailChargesAction, postChargesAction } from "./actions";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfYearIso(): string {
  return `${new Date().getUTCFullYear()}-01-01`;
}

export default async function BorrowerOutstandingChargesPage({
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

  const chargesList = selectedIds.length > 0 ? await getMultipleOutstandingCharges(selectedIds, startDate, endDate) : [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/reports/borrower" className="text-sm font-medium text-blue-700 hover:underline print:hidden">
        ← Borrower Reports
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold text-slate-900 print:hidden">Outstanding Charges</h1>
      <p className="mb-4 text-sm text-slate-500 print:hidden">Unpaid charges posted against one or more borrowers' accounts over a date range.</p>
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
          {chargesList.map((data) => {
            const selected = optionsById.get(data.contractId);
            return (
              <section key={data.contractId} className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="p-4">
                  <ReportActionBar
                    excelHref={`/reports/borrower/outstanding-charges/export?contractId=${data.contractId}&startDate=${startDate}&endDate=${endDate}`}
                    defaultRecipientEmail={selected?.buyerEmail ?? selected?.borrowerPortalEmail ?? ""}
                    onEmail={emailChargesAction.bind(null, data.contractId, startDate, endDate)}
                    onPost={postChargesAction.bind(null, data.contractId, startDate, endDate)}
                  />

                  <h2 className="text-lg font-semibold text-slate-900">Outstanding Charges — {data.contractNumber}</h2>
                  <p className="mb-4 text-sm text-slate-500">{data.borrowerName}</p>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px] text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Description</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                          <th className="px-3 py-2 text-right">Remaining</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.charges.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-3 py-4 text-center text-slate-400">
                              No unpaid charges in this range.
                            </td>
                          </tr>
                        ) : (
                          data.charges.map((c, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2">{formatDate(c.chargeDate)}</td>
                              <td className="px-3 py-2">{c.description}</td>
                              <td className="px-3 py-2 text-right">{formatCents(c.amountCents)}</td>
                              <td className="px-3 py-2 text-right">{formatCents(c.remainingCents)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200 font-medium">
                          <td className="px-3 py-2" colSpan={3}>
                            Total
                          </td>
                          <td className="px-3 py-2 text-right">{formatCents(data.totalRemainingCents)}</td>
                        </tr>
                      </tfoot>
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
