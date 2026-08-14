import Link from "next/link";
import { Calculator } from "lucide-react";
import CategoryTabs from "../../_components/CategoryTabs";

// ACH Payments lives under the Lender category (it's a lender-distribution
// report) — not duplicated here to avoid the same report appearing twice
// with two different descriptions across categories.
const ACCOUNTING_REPORTS = [
  {
    label: "Chart of Accounts",
    href: "/reports/accounting/chart-of-accounts",
    description: "Full GL code list — code, description, and type.",
  },
  {
    label: "Profit & Loss",
    href: "/reports/accounting/profit-and-loss",
    description: "Servicing income (fees) over a date range — not the full company P&L.",
  },
  {
    label: "Balance Sheet",
    href: "/reports/accounting/balance-sheet",
    description: "Trust/escrow and lender-payable positions as of a date — not the full company Balance Sheet.",
  },
  {
    label: "Check Register",
    href: "/reports/accounting/check-register",
    description: "Checks written, by bank account (Operating, Owner Trust, Escrow) and date range.",
  },
];

export default function AccountingReportsPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="mb-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
        <Calculator size={20} className="text-slate-400" aria-hidden="true" />
        Reports
      </h1>
      <p className="mb-4 text-sm text-slate-500">Internal accounting reports.</p>
      <CategoryTabs basePath="/reports" />

      <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {ACCOUNTING_REPORTS.map((r) => (
          <Link key={r.href} href={r.href} className="block px-4 py-3 transition-colors hover:bg-slate-50">
            <p className="font-medium text-blue-700">{r.label}</p>
            <p className="text-sm text-slate-500">{r.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
