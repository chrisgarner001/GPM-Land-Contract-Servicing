import Link from "next/link";
import CategoryTabs from "../../../_components/CategoryTabs";
import ReportActionBar from "../../_components/ReportActionBar";
import { getBankAccountOptions, getCheckRegisterData } from "@/server/accountingReports";
import { formatCents, formatDate } from "@/lib/format";
import { emailCheckRegisterAction } from "./actions";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - days);
  return now.toISOString().slice(0, 10);
}

export default async function CheckRegisterReportPage({
  searchParams,
}: {
  searchParams: Promise<{ bankAccount?: string; startDate?: string; endDate?: string }>;
}) {
  const params = await searchParams;
  const bankAccountFilter = params.bankAccount || "ALL";
  const startDate = params.startDate || daysAgoIso(90);
  const endDate = params.endDate || todayIso();

  const [accounts, data] = await Promise.all([
    getBankAccountOptions(),
    getCheckRegisterData(bankAccountFilter, startDate, endDate),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link href="/reports/accounting" className="text-sm font-medium text-blue-700 hover:underline print:hidden">
        ← Accounting Reports
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold text-slate-900 print:hidden">Check Register</h1>
      <p className="mb-1 text-sm text-slate-500 print:hidden">Checks written, filtered by bank account and date range.</p>
      <p className="mb-4 text-xs text-amber-700 print:hidden">
        Historical checks were imported with no bank-account field. Lender distributions are reliably classified as
        Owner Trust (the only account that type of check ever draws from); everything else the import didn&apos;t
        carry a signal for shows under &ldquo;Unclassified.&rdquo;
      </p>
      <div className="print:hidden">
        <CategoryTabs basePath="/reports" />
      </div>

      <form method="get" className="mb-8 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="bankAccount">
            Bank Account
          </label>
          <select
            id="bankAccount"
            name="bankAccount"
            defaultValue={bankAccountFilter}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="ALL">All Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
            <option value="UNCLASSIFIED">Unclassified</option>
          </select>
        </div>
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
        excelHref={`/reports/accounting/check-register/export?bankAccount=${bankAccountFilter}&startDate=${startDate}&endDate=${endDate}`}
        onEmail={emailCheckRegisterAction.bind(null, bankAccountFilter, startDate, endDate)}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Check Register — {data.bankAccountLabel}</h2>
        <p className="mb-4 text-sm text-slate-500">
          {formatDate(startDate)} – {formatDate(endDate)} · {data.rows.length} checks
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2">Date</th>
                <th className="py-2">Check #</th>
                <th className="py-2">Payee</th>
                <th className="py-2">Method</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-1.5 text-slate-600">{formatDate(r.checkDate)}</td>
                  <td className="py-1.5 text-slate-500">{r.checkNumber}</td>
                  <td className="py-1.5 text-slate-700">
                    {r.payeeName} <span className="text-xs text-slate-400">({r.payeeCode})</span>
                  </td>
                  <td className="py-1.5 text-slate-500">{r.paymentMethod}</td>
                  <td className="py-1.5 text-right tabular-nums font-medium text-slate-900">{formatCents(r.totalAmountCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 font-semibold text-slate-900">
                <td className="py-1.5" colSpan={4}>
                  Total
                </td>
                <td className="py-1.5 text-right">{formatCents(data.totalCents)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </main>
  );
}
