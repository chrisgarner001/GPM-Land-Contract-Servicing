import Link from "next/link";
import CategoryTabs from "../../../_components/CategoryTabs";
import ReportActionBar from "../../_components/ReportActionBar";
import { getListedForSaleProperties, LOAN_TYPE_LABELS } from "@/server/loanReports";
import { formatCents, formatDate } from "@/lib/format";
import { emailListedForSaleAction } from "./actions";

export default async function ListedForSalePage() {
  const rows = await getListedForSaleProperties();

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/reports/loan" className="text-sm font-medium text-blue-700 hover:underline print:hidden">
        ← Loan Reports
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold text-slate-900 print:hidden">Properties Listed For Sale</h1>
      <p className="mb-4 text-sm text-slate-500 print:hidden">
        Sweeps every active contract&apos;s latest AssessorSearch data for a property currently listed for sale —
        across all loan types, since a pending sale matters regardless of how the loan is structured.
      </p>
      <div className="print:hidden">
        <CategoryTabs basePath="/reports" />
      </div>

      <ReportActionBar excelHref="/reports/loan/listed-for-sale/export" onEmail={emailListedForSaleAction} />

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Contract #</th>
              <th className="px-4 py-3">Loan Type</th>
              <th className="px-4 py-3">Lender</th>
              <th className="px-4 py-3">Borrower</th>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3">Listed Date</th>
              <th className="px-4 py-3">Data As Of</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  No active contract&apos;s property is currently listed for sale, per the latest assessor data on file.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.contractId}>
                  <td className="px-4 py-3">
                    <Link href={`/contracts/${r.contractId}`} prefetch={false} className="font-medium text-blue-700 hover:underline">
                      {r.contractNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{LOAN_TYPE_LABELS[r.loanType] ?? r.loanType}</td>
                  <td className="px-4 py-3 text-slate-600">{r.lenderName ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.borrowerName ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.propertyAddress}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCents(r.currentPrincipalBalanceCents)}</td>
                  <td className="px-4 py-3 text-slate-600">{r.isListedDate ? formatDate(r.isListedDate) : "—"}</td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(r.assessorFetchedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
