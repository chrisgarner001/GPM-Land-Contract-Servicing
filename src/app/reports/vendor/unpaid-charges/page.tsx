import Link from "next/link";
import CategoryTabs from "../../../_components/CategoryTabs";
import ReportActionBar from "../../_components/ReportActionBar";
import { getVendorOptions, getVendorUnpaidCharges } from "@/server/vendorReports";
import { formatCents, formatDate } from "@/lib/format";
import { emailVendorUnpaidChargesAction } from "./actions";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfYearIso(): string {
  return `${new Date().getUTCFullYear()}-01-01`;
}

export default async function VendorUnpaidChargesPage({
  searchParams,
}: {
  searchParams: Promise<{ vendorIds?: string | string[]; all?: string; startDate?: string; endDate?: string }>;
}) {
  const params = await searchParams;
  const startDate = params.startDate || startOfYearIso();
  const endDate = params.endDate || todayIso();

  const vendorOptions = await getVendorOptions();
  const vendorsById = new Map(vendorOptions.map((v) => [v.id, v]));
  const rawSelected = params.vendorIds ? (Array.isArray(params.vendorIds) ? params.vendorIds : [params.vendorIds]) : [];
  const selectedIds = params.all === "1" ? vendorOptions.map((v) => v.id) : rawSelected;

  const data = selectedIds.length > 0 ? await getVendorUnpaidCharges(selectedIds, startDate, endDate) : [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/reports/vendor" className="text-sm font-medium text-blue-700 hover:underline print:hidden">
        ← Vendor Reports
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold text-slate-900 print:hidden">Unpaid Charges</h1>
      <p className="mb-1 text-sm text-slate-500 print:hidden">Charges posted to a vendor that haven&apos;t been paid yet.</p>
      <p className="mb-4 text-xs text-amber-700 print:hidden">
        Invoices marked &ldquo;pay by check&rdquo; that haven&apos;t been printed yet (see Vendors &gt; Print
        Checks). Other payment methods have no pending state in this system once entered — they&apos;re considered
        settled the moment they&apos;re recorded.
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
          All Vendors
        </label>

        <div className="grid max-h-56 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto rounded-md border border-slate-200 p-3 sm:grid-cols-3">
          {vendorOptions.map((v) => (
            <label key={v.id} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="vendorIds" value={v.id} defaultChecked={rawSelected.includes(v.id)} />
              {v.displayName}
            </label>
          ))}
        </div>
      </form>

      {selectedIds.length === 0 ? (
        <p className="text-sm text-slate-400">Select one or more vendors (or "All Vendors") and click Run Report.</p>
      ) : (
        <div className="space-y-8">
          {data.map((d) => (
            <section key={d.vendorId} className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="p-4">
                <ReportActionBar
                  excelHref={`/reports/vendor/unpaid-charges/export?vendorIds=${d.vendorId}&startDate=${startDate}&endDate=${endDate}`}
                  onEmail={emailVendorUnpaidChargesAction.bind(null, d.vendorId, startDate, endDate)}
                />

                <h2 className="text-lg font-semibold text-slate-900">
                  Unpaid Charges — {vendorsById.get(d.vendorId)?.displayName ?? "Unknown Vendor"}
                </h2>
                <p className="mb-4 text-sm text-slate-500">
                  {formatDate(startDate)} – {formatDate(endDate)}
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">GL Code</th>
                        <th className="px-3 py-2">Land Contract</th>
                        <th className="px-3 py-2">Due Date</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2">Payment Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {d.rows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                            No unpaid charges in this range.
                          </td>
                        </tr>
                      ) : (
                        d.rows.map((r) => (
                          <tr key={r.id}>
                            <td className="px-3 py-2">{r.glCode ?? "—"}</td>
                            <td className="px-3 py-2">{r.contractNumber ?? "—"}</td>
                            <td className="px-3 py-2">{formatDate(r.dueDate)}</td>
                            <td className="px-3 py-2 text-right">{formatCents(r.amountCents)}</td>
                            <td className="px-3 py-2">{r.paymentMethod}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 font-medium">
                        <td className="px-3 py-2" colSpan={3}>
                          Total
                        </td>
                        <td className="px-3 py-2 text-right">{formatCents(d.totalCents)}</td>
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
