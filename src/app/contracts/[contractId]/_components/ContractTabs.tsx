"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/terms", label: "Terms" },
  { href: "/history", label: "History" },
  { href: "/trust-ledger", label: "Trust Ledger" },
  { href: "/escrow-analysis", label: "Escrow Analysis" },
  { href: "/funding", label: "Funding" },
];

export function ContractTabs({ contractId, extra }: { contractId: string; extra?: React.ReactNode }) {
  const pathname = usePathname();
  const base = `/contracts/${contractId}`;

  return (
    <nav className="flex items-center gap-1 border-b border-slate-200 px-6">
      {TABS.map((tab) => {
        const href = `${base}${tab.href}`;
        const isActive = pathname === href;
        return (
          <Link
            key={tab.label}
            href={href}
            className={`border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
      {extra}
    </nav>
  );
}
