import Link from "next/link";
import { Receipt } from "lucide-react";

const TAX_FORMS = [
  {
    label: "Lender 1099-INT",
    href: "/tax-forms/lender-1099-int",
    description: "Interest paid to each lender by tax year — the number for Box 1 of a real 1099-INT.",
  },
  {
    label: "Borrower 1098",
    href: "/tax-forms/borrower-1098",
    description: "Mortgage interest received from each borrower by tax year — the number for Box 1 of a real 1098.",
  },
];

export default function TaxFormsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
        <Receipt size={20} className="text-slate-400" aria-hidden="true" />
        Tax Forms
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Worksheets for preparing real tax filings — not the official IRS forms themselves.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TAX_FORMS.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className="block rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:bg-slate-50"
          >
            <p className="font-medium text-blue-700">{f.label}</p>
            <p className="mt-1 text-sm text-slate-500">{f.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
