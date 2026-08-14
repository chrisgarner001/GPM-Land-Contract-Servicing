"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Landmark, Truck, HandCoins, Calculator, LayoutTemplate, type LucideIcon } from "lucide-react";

// Icon is a name key, not a component reference — this array (or the
// Notices override) is authored in a plain server-side module and passed
// as a prop into this Client Component, and a live component reference
// can't cross that boundary (only plain serializable data can). The actual
// icon components stay local to this client module and get looked up here.
export type CategoryTabIconName = keyof typeof ICONS;

const ICONS = {
  Users,
  Landmark,
  Truck,
  HandCoins,
  Calculator,
  LayoutTemplate,
} satisfies Record<string, LucideIcon>;

export interface CategoryTabItem {
  label: string;
  segment: string;
  icon: CategoryTabIconName;
}

const DEFAULT_CATEGORIES: CategoryTabItem[] = [
  { label: "Borrower", segment: "borrower", icon: "Users" },
  { label: "Lender", segment: "lender", icon: "Landmark" },
  { label: "Vendor", segment: "vendor", icon: "Truck" },
  { label: "Loan", segment: "loan", icon: "HandCoins" },
  { label: "Accounting", segment: "accounting", icon: "Calculator" },
];

// Shared by /reports and /notices — both organized by category, so this tab
// row is parameterized by basePath rather than duplicated per section.
// Reports keeps the default four; Notices overrides via `categories` since
// it swaps Loan for Template Builder (see notices/*/page.tsx).
export default function CategoryTabs({ basePath, categories = DEFAULT_CATEGORIES }: { basePath: string; categories?: CategoryTabItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex items-center gap-1 border-b border-slate-200">
      {categories.map((c) => {
        const href = `${basePath}/${c.segment}`;
        const isActive = pathname === href;
        const Icon = ICONS[c.icon];
        return (
          <Link
            key={c.segment}
            href={href}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <Icon size={15} className="shrink-0" aria-hidden="true" />
            {c.label}
          </Link>
        );
      })}
    </nav>
  );
}
