import Link from "next/link";
import CategoryTabs from "../../../_components/CategoryTabs";
import ReportActionBar from "../../_components/ReportActionBar";
import { db } from "@/db/client";
import { glCodes } from "@/db/schema/setup";
import { GL_CODE_TYPE_LABELS } from "@/app/setup/gl-codes/glCodeTypeLabels";
import { emailChartOfAccountsAction } from "./actions";

export default async function ChartOfAccountsReportPage() {
  const rows = await db.select().from(glCodes).orderBy(glCodes.code);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link href="/reports/accounting" className="text-sm font-medium text-blue-700 hover:underline print:hidden">
        ← Accounting Reports
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold text-slate-900 print:hidden">Chart of Accounts</h1>
      <p className="mb-4 text-sm text-slate-500 print:hidden">Full GL code list — code, description, and type.</p>
      <div className="print:hidden">
        <CategoryTabs basePath="/reports" />
      </div>

      <ReportActionBar excelHref="/setup/gl-codes/export" onEmail={emailChartOfAccountsAction} />

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-slate-400">
                  No GL codes on record yet.
                </td>
              </tr>
            ) : (
              rows.map((g) => (
                <tr key={g.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{g.code}</td>
                  <td className="px-4 py-3 text-slate-600">{g.description ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{g.type ? GL_CODE_TYPE_LABELS[g.type] : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
