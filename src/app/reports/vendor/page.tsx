import Link from "next/link";
import { Truck } from "lucide-react";
import CategoryTabs from "../../_components/CategoryTabs";

const VENDOR_REPORTS = [
  {
    label: "Statement of Account",
    href: "/reports/vendor/statement-of-account",
    description: "Charges, payments, and balance for one or more vendors over a date range.",
  },
  {
    label: "Unpaid Charges",
    href: "/reports/vendor/unpaid-charges",
    description: "Charges posted to a vendor that have not yet been paid.",
  },
  {
    label: "Name & Address Listing",
    href: "/reports/vendor/name-address-listing",
    description: "Vendor name and mailing address list.",
  },
];

export default function VendorReportsPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="mb-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
        <Truck size={20} className="text-slate-400" aria-hidden="true" />
        Reports
      </h1>
      <p className="mb-4 text-sm text-slate-500">Vendor reports.</p>
      <CategoryTabs basePath="/reports" />

      <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {VENDOR_REPORTS.map((r) => (
          <Link key={r.href} href={r.href} className="block px-4 py-3 transition-colors hover:bg-slate-50">
            <p className="font-medium text-blue-700">{r.label}</p>
            <p className="text-sm text-slate-500">{r.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
