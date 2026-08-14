import Link from "next/link";
import { Bell } from "lucide-react";
import CategoryTabs from "../_components/CategoryTabs";
import { NOTICES_TAB_CATEGORIES } from "./_categories";

const CATEGORIES = [
  { label: "Borrower", href: "/notices/borrower", description: "Late notices, payment reminders, and other borrower-facing notices." },
  { label: "Lender", href: "/notices/lender", description: "Distribution notices and other lender-facing notices." },
  { label: "Vendor", href: "/notices/vendor", description: "Payment notices and other vendor-facing notices." },
  { label: "Template Builder", href: "/notices/template-builder", description: "Draft and approve new notice templates with AI assistance." },
];

export default function NoticesPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="mb-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
        <Bell size={20} className="text-slate-400" aria-hidden="true" />
        Notices
      </h1>
      <p className="mb-4 text-sm text-slate-500">Choose an area to see its available notices.</p>
      <CategoryTabs basePath="/notices" categories={NOTICES_TAB_CATEGORIES} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CATEGORIES.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-300 hover:bg-slate-50"
          >
            <h3 className="font-medium text-slate-900">{c.label}</h3>
            <p className="mt-1 text-sm text-slate-500">{c.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
