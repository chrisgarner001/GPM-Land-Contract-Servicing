import Link from "next/link";
import CategoryTabs from "../../../_components/CategoryTabs";
import ReportActionBar from "../../_components/ReportActionBar";
import { getServicingIncomeStatement } from "@/server/accountingReports";
import { formatCents, formatDate } from "@/lib/format";
import { emailProfitAndLossAction } from "./actions";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfYearIso(): string {
  return `${new Date().getUTCFullYear()}-01-01`;
}

export default async function ProfitAndLossPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string }>;
}) {
  const params = await searchParams;
  const startDate = params.startDate || startOfYearIso();
  const endDate = params.endDate || todayIso();

  const data = await getServicingIncomeStatement(startDate, endDate);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/reports/accounting" className="text-sm font-medium text-blue-700 hover:underline print:hidden">
        ← Accounting Reports
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold text-slate-900 print:hidden">Profit &amp; Loss</h1>
      <p className="mb-1 text-sm text-slate-500 print:hidden">Loan-servicing income over a date range.</p>
      <p className="mb-4 text-xs text-amber-700 print:hidden">
        Servicing income only — this app has no general ledger and doesn't track operating expenses (payroll, rent,
        etc.); those live in QuickBooks. Not the full company Profit &amp; Loss. Late fees are lender revenue, not
        SGMS's, so they aren&apos;t shown here — see Lender Payment Run / ACH Payments.
      </p>
      <div className="print:hidden">
        <CategoryTabs basePath="/reports" />
      </div>

      <form method="get" className="mb-8 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm print:hidden">
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
      </form>

      <ReportActionBar
        excelHref={`/reports/accounting/profit-and-loss/export?startDate=${startDate}&endDate=${endDate}`}
        onEmail={emailProfitAndLossAction.bind(null, startDate, endDate)}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Servicing Income Statement</h2>
        <p className="mb-4 text-sm text-slate-500">
          {formatDate(startDate)} – {formatDate(endDate)}
        </p>
        <table className="w-full max-w-md text-sm">
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="py-1.5 text-slate-500">Broker/Servicing Fees Collected</td>
              <td className="py-1.5 text-right">{formatCents(data.servicingFeesCents)}</td>
            </tr>
            <tr className="border-t border-slate-200 font-semibold text-slate-900">
              <td className="py-1.5">Net Servicing Income</td>
              <td className="py-1.5 text-right">{formatCents(data.totalIncomeCents)}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  );
}
