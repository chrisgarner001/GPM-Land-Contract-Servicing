import { Printer } from "lucide-react";
import { getUnprintedChecks } from "@/server/printChecks";
import { formatCents, formatDate } from "@/lib/format";

export default async function PrintLenderChecksPage() {
  const pending = await getUnprintedChecks("Owner Trust");

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
        <Printer size={20} className="text-slate-400" aria-hidden="true" />
        Print Checks
      </h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Lender distribution checks recorded via Lender Payment Runs, drawn on Owner Trust, that haven&apos;t been
        printed yet.
      </p>

      {pending.length === 0 ? (
        <p className="text-sm text-slate-500">No unprinted checks — run a Lender Payment Run to create some.</p>
      ) : (
        <form action="/checks/print/confirm" method="get" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <input type="hidden" name="returnTo" value="/lenders/print-checks" />
          <table className="mb-4 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 w-8"></th>
                <th className="py-2">Check #</th>
                <th className="py-2">Date</th>
                <th className="py-2">Payee (Lender)</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pending.map((c) => (
                <tr key={c.id}>
                  <td className="py-1.5">
                    <input type="checkbox" name="ids" value={c.id} defaultChecked />
                  </td>
                  <td className="py-1.5 text-slate-500">{c.checkNumber}</td>
                  <td className="py-1.5 text-slate-600">{formatDate(c.checkDate)}</td>
                  <td className="py-1.5 text-slate-700">{c.payeeName}</td>
                  <td className="py-1.5 text-right tabular-nums font-medium text-slate-900">{formatCents(c.totalAmountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Print Selected
          </button>
        </form>
      )}
    </main>
  );
}
