import Link from "next/link";
import { Settings } from "lucide-react";

const SETUP_SECTIONS = [
  { href: "/setup/users", label: "Users", description: "Staff reference list — name, email, role." },
  { href: "/setup/gl-codes", label: "GL Codes", description: "General ledger codes used when classifying vendor invoices." },
  { href: "/setup/bank-accounts", label: "Bank Accounts", description: "Operating, Escrow, and Owner Trust accounts." },
  {
    href: "/setup/company-settings",
    label: "Company Settings",
    description: "This deployment's own business identity — Lender entity, document preparer, default deed contact.",
  },
];

export default function SetupPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
        <Settings size={20} className="text-slate-400" aria-hidden="true" />
        Setup
      </h1>
      <p className="mb-6 text-sm text-slate-500">System configuration.</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SETUP_SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 hover:shadow"
          >
            <p className="font-medium text-slate-900">{s.label}</p>
            <p className="mt-1 text-sm text-slate-500">{s.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
