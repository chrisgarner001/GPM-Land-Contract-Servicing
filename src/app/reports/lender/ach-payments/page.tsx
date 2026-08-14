import Link from "next/link";
import { Banknote } from "lucide-react";
import CategoryTabs from "../../../_components/CategoryTabs";
import PrintButton from "@/app/setup/gl-codes/_components/PrintButton";
import PostAllButton from "./_components/PostAllButton";
import { getLenderOptions, getAchPaymentsData } from "@/server/lenderReports";
import { formatCents, formatDate } from "@/lib/format";
import { postAllAchPaymentsAction } from "./actions";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfYearIso(): string {
  return `${new Date().getUTCFullYear()}-01-01`;
}

export default async function AchPaymentsPage({
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

  const allData = selectedIds.length > 0 ? await getAchPaymentsData(selectedIds, startDate, endDate) : [];
  // Only lenders that actually have ACH payments due in this range — an
  // empty section per lender was just noise for a report whose whole point
  // is "who do I need to pay via ACH."
  const dataByLenderId = new Map(allData.filter((d) => d.checks.length > 0).map((d) => [d.lenderId, d]));
  const lenderIdsWithPayments = selectedIds.filter((id) => dataByLenderId.has(id));
  const grandTotalCents = lenderIdsWithPayments.reduce((s, id) => s + (dataByLenderId.get(id)?.totalAmountCents ?? 0), 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/reports/lender" className="text-sm font-medium text-blue-700 hover:underline print:hidden">
        ← Lender Reports
      </Link>
      <h1 className="mt-2 mb-1 flex items-center gap-2 text-xl font-semibold text-slate-900 print:hidden">
        <Banknote size={20} className="text-slate-400" aria-hidden="true" />
        ACH Payments
      </h1>
      <p className="mb-4 text-sm text-slate-500 print:hidden">
        Lender distributions run via ACH, with a per-contract breakdown. Only lenders with a payment due in this
        range are shown.
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
        <p className="text-sm text-slate-400">Select one or more lenders (or &quot;All Lenders&quot;) and click Run Report.</p>
      ) : lenderIdsWithPayments.length === 0 ? (
        <p className="text-sm text-slate-400">No lenders have ACH payments due in this range.</p>
      ) : (
        <>
          <div className="mb-6 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm print:hidden">
            <div className="flex items-center gap-2">
              <PrintButton />
              <PostAllButton onPost={postAllAchPaymentsAction.bind(null, lenderIdsWithPayments, startDate, endDate)} />
            </div>
            <p className="text-sm text-slate-500">
              {lenderIdsWithPayments.length} lender{lenderIdsWithPayments.length === 1 ? "" : "s"} · Total to enter:{" "}
              <span className="font-semibold text-slate-900">{formatCents(grandTotalCents)}</span>
            </p>
          </div>

          <h2 className="mb-1 text-lg font-semibold text-slate-900">ACH Payments — {formatDate(startDate)} – {formatDate(endDate)}</h2>
          <p className="mb-4 text-sm text-slate-500">Combined report — enter each amount below into the banking system.</p>

          <div className="mb-8 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Lender</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lenderIdsWithPayments.map((id) => (
                  <tr key={id}>
                    <td className="px-4 py-2 text-slate-700">{lendersById.get(id)?.displayName ?? "Unknown Lender"}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium text-slate-900">
                      {formatCents(dataByLenderId.get(id)!.totalAmountCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 font-semibold text-slate-900">
                  <td className="px-4 py-2">Total</td>
                  <td className="px-4 py-2 text-right">{formatCents(grandTotalCents)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="space-y-8">
            {lenderIdsWithPayments.map((lenderId) => {
              const data = dataByLenderId.get(lenderId)!;
              const lenderName = lendersById.get(lenderId)?.displayName ?? "Unknown Lender";
              return (
                <section key={lenderId} className="rounded-lg border border-slate-200 bg-white shadow-sm">
                  <div className="p-4">
                    <h3 className="text-base font-semibold text-slate-900">{lenderName}</h3>

                    <div className="space-y-6">
                      {data.checks.map((c) => (
                        <div key={c.checkId}>
                          <p className="mb-2 text-sm font-semibold text-slate-700">
                            {c.checkNumber} — {formatDate(c.checkDate)} — {formatCents(c.totalAmountCents)}
                          </p>
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[700px] text-sm">
                              <thead>
                                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  <th className="px-3 py-2">Land Contract</th>
                                  <th className="px-3 py-2 text-right">Payment Amount</th>
                                  <th className="px-3 py-2 text-right">Interest Paid</th>
                                  <th className="px-3 py-2 text-right">Principal Paid</th>
                                  <th className="px-3 py-2 text-right">Late Charges</th>
                                  <th className="px-3 py-2 text-right">Other Charges</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {c.lines.map((l, i) => (
                                  <tr key={i}>
                                    <td className="px-3 py-2">{l.contractNumber ?? "—"}</td>
                                    <td className="px-3 py-2 text-right">{formatCents(l.amountCents)}</td>
                                    <td className="px-3 py-2 text-right">{formatCents(l.interestCents)}</td>
                                    <td className="px-3 py-2 text-right">{formatCents(l.principalCents)}</td>
                                    <td className="px-3 py-2 text-right">{formatCents(l.lateChargesCents)}</td>
                                    <td className="px-3 py-2 text-right text-slate-400">{formatCents(l.otherChargesCents)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                      <p className="text-right text-sm font-semibold text-slate-900">Total: {formatCents(data.totalAmountCents)}</p>
                    </div>
                    <p className="mt-3 text-xs text-slate-400">
                      Late Charges are the lender&apos;s own money and are already included in Total. Other Charges are
                      shown for context only — that revenue stays with SGMS and is never part of the Total paid to
                      the lender.
                    </p>
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
