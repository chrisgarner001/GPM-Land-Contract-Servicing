import Link from "next/link";
import { HandCoins } from "lucide-react";
import CategoryTabs from "../../_components/CategoryTabs";

const LOAN_REPORTS = [
  {
    label: "Land Contract Equity Analysis",
    href: "/reports/loan/equity-analysis",
    description: "Land Contract balance vs. AssessorSearch estimated market value — a refi-marketing candidate list for LC holders with 20%+ estimated equity.",
  },
  {
    label: "Properties Listed For Sale",
    href: "/reports/loan/listed-for-sale",
    description: "Active contracts whose collateral property is currently listed for sale, per the latest AssessorSearch data.",
  },
];

export default function LoanReportsPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="mb-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
        <HandCoins size={20} className="text-slate-400" aria-hidden="true" />
        Reports
      </h1>
      <p className="mb-4 text-sm text-slate-500">Loan (portfolio-wide) reports.</p>
      <CategoryTabs basePath="/reports" />

      <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {LOAN_REPORTS.map((r) => (
          <Link key={r.href} href={r.href} className="block px-4 py-3 transition-colors hover:bg-slate-50">
            <p className="font-medium text-blue-700">{r.label}</p>
            <p className="text-sm text-slate-500">{r.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
