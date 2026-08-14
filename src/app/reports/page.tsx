import Link from "next/link";
import { BarChart3, Users, Landmark, Truck, HandCoins, Calculator, type LucideIcon } from "lucide-react";
import CategoryTabs from "../_components/CategoryTabs";

const CATEGORIES: { label: string; href: string; description: string; icon: LucideIcon }[] = [
  { label: "Borrower", href: "/reports/borrower", description: "Borrower-facing reports — payment history, account status, and more.", icon: Users },
  { label: "Lender", href: "/reports/lender", description: "Lender-facing reports — funding, ledger activity, distributions, and more.", icon: Landmark },
  { label: "Vendor", href: "/reports/vendor", description: "Vendor-facing reports — invoices, payments, and check history.", icon: Truck },
  { label: "Loan", href: "/reports/loan", description: "Portfolio-wide loan reports — delinquency, payoff, aging, and more.", icon: HandCoins },
  { label: "Accounting", href: "/reports/accounting", description: "Chart of accounts and other internal accounting reports.", icon: Calculator },
];

export default function ReportsPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="mb-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
        <BarChart3 size={20} className="text-slate-400" aria-hidden="true" />
        Reports
      </h1>
      <p className="mb-4 text-sm text-slate-500">Choose an area to see its available reports.</p>
      <CategoryTabs basePath="/reports" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CATEGORIES.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-300 hover:bg-slate-50"
          >
            <h3 className="flex items-center gap-2 font-medium text-slate-900">
              <c.icon size={16} className="text-slate-400" aria-hidden="true" />
              {c.label}
            </h3>
            <p className="mt-1 text-sm text-slate-500">{c.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
