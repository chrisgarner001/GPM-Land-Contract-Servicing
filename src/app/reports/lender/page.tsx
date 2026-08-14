import Link from "next/link";
import { Landmark } from "lucide-react";
import CategoryTabs from "../../_components/CategoryTabs";

const LENDER_REPORTS = [
  {
    label: "Statement of Account",
    href: "/reports/lender/statement-of-account",
    description: "Portfolio balance, investment portfolio, and funding activity for one or more lenders over a date range.",
  },
  {
    label: "Accrued Interest Report",
    href: "/reports/lender/accrued-interest",
    description: "Interest accrued but not yet paid out, per lender, as of a given date.",
  },
  {
    label: "Portfolio Change in Principal",
    href: "/reports/lender/portfolio-change-in-principal",
    description: "Principal balance change across a lender's portfolio over a date range.",
  },
  {
    label: "Portfolio Charges Report",
    href: "/reports/lender/portfolio-charges",
    description: "Charges/advances posted against a lender's funded contracts over a date range.",
  },
  {
    label: "Name & Address Listing",
    href: "/reports/lender/name-address-listing",
    description: "Lender name and mailing address list.",
  },
  {
    label: "ACH Payments",
    href: "/reports/lender/ach-payments",
    description: "Lender distributions run via ACH, with a per-contract breakdown, over a date range.",
  },
];

export default function LenderReportsPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="mb-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
        <Landmark size={20} className="text-slate-400" aria-hidden="true" />
        Reports
      </h1>
      <p className="mb-4 text-sm text-slate-500">Lender reports.</p>
      <CategoryTabs basePath="/reports" />

      <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {LENDER_REPORTS.map((r) => (
          <Link key={r.href} href={r.href} className="block px-4 py-3 transition-colors hover:bg-slate-50">
            <p className="font-medium text-blue-700">{r.label}</p>
            <p className="text-sm text-slate-500">{r.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
