import Link from "next/link";
import ReportActionBar from "../../reports/_components/ReportActionBar";
import { getLender1099Data } from "@/server/taxForms";
import { formatCents } from "@/lib/format";
import { emailLender1099Action } from "./actions";

function lastTaxYear(): number {
  return new Date().getUTCFullYear() - 1;
}

export default async function Lender1099Page({
  searchParams,
}: {
  searchParams: Promise<{ taxYear?: string }>;
}) {
  const params = await searchParams;
  const taxYear = Number(params.taxYear) || lastTaxYear();

  const rows = await getLender1099Data(taxYear);
  const totalCents = rows.reduce((s, r) => s + r.totalInterestCents, 0);
  const belowThreshold = rows.filter((r) => !r.meetsThreshold).length;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link href="/tax-forms" className="text-sm font-medium text-blue-700 hover:underline print:hidden">
        ← Tax Forms
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold text-slate-900 print:hidden">Lender 1099-INT</h1>
      <p className="mb-1 text-sm text-slate-500 print:hidden">Interest paid to each lender by tax year.</p>
      <p className="mb-4 text-xs text-amber-700 print:hidden">
        Worksheet for preparing real 1099-INT filings — the number for Box 1 (Interest Income), not the official IRS
        form. The IRS only requires filing for $10+ paid; lenders below that are still listed, just flagged.
        Historical (pre-this-app) lender credits never stored a structured interest figure — only this app&apos;s own
        live activity is reflected here, so tax years before go-live will be incomplete, not zero-interest.
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
        excelHref={`/tax-forms/lender-1099-int/export?taxYear=${taxYear}`}
        onEmail={emailLender1099Action.bind(null, taxYear)}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">1099-INT Worksheet — Tax Year {taxYear}</h2>
        <p className="mb-4 text-sm text-slate-500">
          {rows.length} lender{rows.length === 1 ? "" : "s"} with reportable interest
          {belowThreshold > 0 && ` (${belowThreshold} below the $10 filing threshold)`}
        </p>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="py-2">Lender</th>
              <th className="py-2 text-right">Interest Paid (Box 1)</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-4 text-center text-slate-400">
                  No lender interest activity in this tax year.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.lenderId}>
                  <td className="py-1.5">{r.displayName}</td>
                  <td className="py-1.5 text-right tabular-nums font-medium text-slate-900">{formatCents(r.totalInterestCents)}</td>
                  <td className="py-1.5 text-xs text-amber-600">{r.meetsThreshold ? "" : "Below $10 threshold"}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-semibold text-slate-900">
              <td className="py-1.5">Total</td>
              <td className="py-1.5 text-right">{formatCents(totalCents)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </section>
    </main>
  );
}
