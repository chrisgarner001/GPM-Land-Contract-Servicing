import Link from "next/link";
import { Users } from "lucide-react";
import CategoryTabs from "../../_components/CategoryTabs";

const BORROWER_REPORTS = [
  {
    label: "Statement of Account",
    href: "/reports/borrower/statement-of-account",
    description: "Loan balance and payment history for one borrower over a date range.",
  },
  {
    label: "Outstanding Charges",
    href: "/reports/borrower/outstanding-charges",
    description: "Unpaid charges posted against a borrower's account.",
  },
  {
    label: "Name & Address Listing",
    href: "/reports/borrower/name-address-listing",
    description: "Borrower name and mailing address list.",
  },
  {
    label: "Payoff Letter",
    href: "/reports/borrower/payoff-letter",
    description: "Payoff amount as of a projected date, with per diem, for a borrower or a third party (title company, attorney).",
  },
];

export default function BorrowerReportsPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="mb-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
        <Users size={20} className="text-slate-400" aria-hidden="true" />
        Reports
      </h1>
      <p className="mb-4 text-sm text-slate-500">Borrower reports.</p>
      <CategoryTabs basePath="/reports" />

      <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {BORROWER_REPORTS.map((r) => (
          <Link key={r.href} href={r.href} className="block px-4 py-3 transition-colors hover:bg-slate-50">
            <p className="font-medium text-blue-700">{r.label}</p>
            <p className="text-sm text-slate-500">{r.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
