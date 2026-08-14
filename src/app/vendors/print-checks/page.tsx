import { Printer } from "lucide-react";
import { getUnprintedVendorDisbursements, getVendorPayableBankAccountOptions } from "@/server/printChecks";
import { formatCents, formatDate } from "@/lib/format";
import { createVendorChecksAction } from "./actions";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function PrintVendorChecksPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const [disbursements, bankAccounts] = await Promise.all([
    getUnprintedVendorDisbursements(),
    getVendorPayableBankAccountOptions(),
  ]);

  const byVendor = new Map<string, typeof disbursements>();
  for (const d of disbursements) {
    const group = byVendor.get(d.vendorId) ?? [];
    group.push(d);
    byVendor.set(d.vendorId, group);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
        <Printer size={20} className="text-slate-400" aria-hidden="true" />
        Print Checks
      </h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Vendor invoices marked &ldquo;pay by check&rdquo; (New Invoice form) that haven&apos;t been printed yet.
        Grouped by vendor — each vendor gets one check covering everything you select for them.
      </p>

      {params.error && <p className="mb-4 text-sm text-red-600">{params.error}</p>}

      {disbursements.length === 0 ? (
        <p className="text-sm text-slate-500">No pending check payments — create a vendor invoice with payment method Check to see it here.</p>
      ) : (
        <form action={createVendorChecksAction} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md bg-slate-50 p-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500" htmlFor="bankAccountId">
                Bank Account
              </label>
              <select id="bankAccountId" name="bankAccountId" required className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                {bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500" htmlFor="checkDate">
                Check Date
              </label>
              <input
                id="checkDate"
                type="date"
                name="checkDate"
                defaultValue={todayIso()}
                required
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500" htmlFor="startingCheckNumber">
                Starting Check # (loaded in printer)
              </label>
              <input
                id="startingCheckNumber"
                type="number"
                name="startingCheckNumber"
                min={1}
                required
                className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="mb-4 space-y-6">
            {[...byVendor.entries()].map(([vendorId, group]) => (
              <div key={vendorId}>
                <p className="mb-1 text-sm font-semibold text-slate-900">
                  {group[0].vendorDisplayName} <span className="text-xs font-normal text-slate-400">({group[0].vendorAccountCode})</span>
                </p>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {group.map((d) => (
                      <tr key={d.id}>
                        <td className="w-8 py-1.5">
                          <input type="checkbox" name="disbursementIds" value={d.id} defaultChecked />
                        </td>
                        <td className="py-1.5 text-slate-600">{formatDate(d.transactionDate)}</td>
                        <td className="py-1.5 text-slate-600">{d.contractNumber}</td>
                        <td className="py-1.5 text-slate-500">{d.reference ?? "—"}</td>
                        <td className="py-1.5 text-right tabular-nums font-medium text-slate-900">{formatCents(d.amountCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Create &amp; Print Checks
          </button>
        </form>
      )}
    </main>
  );
}
