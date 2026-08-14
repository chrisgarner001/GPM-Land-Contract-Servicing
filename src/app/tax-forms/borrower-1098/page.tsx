import Link from "next/link";
import ReportActionBar from "../../reports/_components/ReportActionBar";
import { getBorrower1098Data } from "@/server/taxForms";
import { formatCents } from "@/lib/format";
import { emailBorrower1098Action } from "./actions";

function lastTaxYear(): number {
  return new Date().getUTCFullYear() - 1;
}

export default async function Borrower1098Page({
  searchParams,
}: {
  searchParams: Promise<{ taxYear?: string }>;
}) {
  const params = await searchParams;
  const taxYear = Number(params.taxYear) || lastTaxYear();

  const rows = await getBorrower1098Data(taxYear);
  const totalCents = rows.reduce((s, r) => s + r.totalInterestCents, 0);
  const belowThreshold = rows.filter((r) => !r.meetsThreshold).length;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link href="/tax-forms" className="text-sm font-medium text-blue-700 hover:underline print:hidden">
        ← Tax Forms
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold text-slate-900 print:hidden">Borrower 1098</h1>
      <p className="mb-1 text-sm text-slate-500 print:hidden">Mortgage interest received from each borrower by tax year.</p>
      <p className="mb-4 text-xs text-amber-700 print:hidden">
        Worksheet for preparing real 1098 filings — the number for Box 1 (Mortgage Interest Received), not the
        official IRS form. The IRS only requires filing for $600+ received; borrowers below that are still listed,
        just flagged.
      </p>

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="taxYear">
            Tax Year
          </label>
          <input
            id="taxYear"
            type="number"
            name="taxYear"
            defaultValue={taxYear}
            min={2000}
            max={2100}
            className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
          Run
        </button>
      </form>

      <ReportActionBar
        excelHref={`/tax-forms/borrower-1098/export?taxYear=${taxYear}`}
        onEmail={emailBorrower1098Action.bind(null, taxYear)}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">1098 Worksheet — Tax Year {taxYear}</h2>
        <p className="mb-4 text-sm text-slate-500">
          {rows.length} borrower{rows.length === 1 ? "" : "s"} with reportable interest
          {belowThreshold > 0 && ` (${belowThreshold} below the $600 filing threshold)`}
        </p>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="py-2">Borrower</th>
              <th className="py-2">Land Contract</th>
              <th className="py-2 text-right">Interest Received (Box 1)</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-slate-400">
                  No borrower interest activity in this tax year.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.contractId}>
                  <td className="py-1.5">{r.borrowerName}</td>
                  <td className="py-1.5 text-slate-500">{r.contractNumber}</td>
                  <td className="py-1.5 text-right tabular-nums font-medium text-slate-900">{formatCents(r.totalInterestCents)}</td>
                  <td className="py-1.5 text-xs text-amber-600">{r.meetsThreshold ? "" : "Below $600 threshold"}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-semibold text-slate-900">
              <td className="py-1.5" colSpan={2}>
                Total
              </td>
              <td className="py-1.5 text-right">{formatCents(totalCents)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </section>
    </main>
  );
}
