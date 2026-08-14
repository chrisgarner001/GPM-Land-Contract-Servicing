import Link from "next/link";
import CategoryTabs from "../../../_components/CategoryTabs";
import ReportActionBar from "../../_components/ReportActionBar";
import { getServicingBalanceSheet } from "@/server/accountingReports";
import { formatCents, formatDate } from "@/lib/format";
import { emailBalanceSheetAction } from "./actions";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ asOfDate?: string }>;
}) {
  const params = await searchParams;
  const asOfDate = params.asOfDate || todayIso();

  const data = await getServicingBalanceSheet(asOfDate);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/reports/accounting" className="text-sm font-medium text-blue-700 hover:underline print:hidden">
        ← Accounting Reports
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold text-slate-900 print:hidden">Balance Sheet</h1>
      <p className="mb-1 text-sm text-slate-500 print:hidden">Trust/escrow and lender-payable positions as of a date.</p>
      <p className="mb-4 text-xs text-amber-700 print:hidden">
        This app has no general ledger and doesn't track the business's own cash, assets, or equity — these figures
        are positions held on behalf of borrowers and lenders, plus a portfolio memo. Not the full company Balance
        Sheet.
      </p>
      <div className="print:hidden">
        <CategoryTabs basePath="/reports" />
      </div>

      <form method="get" className="mb-8 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="asOfDate">
            As of Date
          </label>
          <input id="asOfDate" type="date" name="asOfDate" defaultValue={asOfDate} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
        <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
          Run Report
        </button>
      </form>

      <ReportActionBar
        excelHref={`/reports/accounting/balance-sheet/export?asOfDate=${asOfDate}`}
        onEmail={emailBalanceSheetAction.bind(null, asOfDate)}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Servicing Balance Sheet (Trust &amp; Portfolio Positions)</h2>
        <p className="mb-4 text-sm text-slate-500">As of {formatDate(data.asOfDate)}</p>

        <h3 className="mb-2 text-sm font-semibold text-slate-700">Held on Behalf of Others (liabilities)</h3>
        <table className="mb-6 w-full max-w-md text-sm">
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="py-1.5 text-slate-500">Escrow/Trust Held</td>
              <td className="py-1.5 text-right">{formatCents(data.escrowHeldCents)}</td>
            </tr>
            <tr>
              <td className="py-1.5 text-slate-500">Lender Payable</td>
              <td className="py-1.5 text-right">{formatCents(data.lenderPayableCents)}</td>
            </tr>
            <tr>
              <td className="py-1.5 text-slate-500">Borrower Reserve Held</td>
              <td className="py-1.5 text-right">{formatCents(data.borrowerReserveHeldCents)}</td>
            </tr>
          </tbody>
        </table>

        <h3 className="mb-2 text-sm font-semibold text-slate-700">Portfolio Memo (informational)</h3>
        <table className="w-full max-w-md text-sm">
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="py-1.5 text-slate-500">Total Principal Under Servicing (active contracts)</td>
              <td className="py-1.5 text-right">{formatCents(data.totalPrincipalUnderServicingCents)}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  );
}
