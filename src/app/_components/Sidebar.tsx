"use client";

import Link from "next/link";
import CompanyLogo from "./CompanyLogo";
import { usePathname } from "next/navigation";
import {
  FileText,
  Users,
  Landmark,
  Truck,
  BarChart3,
  Bell,
  Receipt,
  FileSpreadsheet,
  PiggyBank,
  Settings,
  Sparkles,
  FilePlus2,
  ScanLine,
  UserPlus,
  Send,
  Printer,
  Banknote,
  ClipboardList,
  ReceiptText,
  ScrollText,
  HandCoins,
  Calculator,
  UserCog,
  Hash,
  Building2,
  LayoutTemplate,
  Home,
  FileSignature,
  type LucideIcon,
} from "lucide-react";
import RecentItems from "./RecentItems";
import GlobalSearchBox from "./GlobalSearchBox";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: { label: string; href: string; icon: LucideIcon }[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Land Contracts",
    href: "/contracts",
    icon: FileText,
    children: [
      { label: "On Boarding", href: "/onboarding", icon: FilePlus2 },
      { label: "Bulk Payment", href: "/bulk-payment", icon: ScanLine },
    ],
  },
  {
    label: "Properties",
    href: "/properties",
    icon: Home,
  },
  {
    label: "Borrowers",
    href: "/borrowers",
    icon: Users,
  },
  {
    label: "Lenders",
    href: "/lenders",
    icon: Landmark,
    children: [
      { label: "New Lender", href: "/lenders/new", icon: UserPlus },
      { label: "Lender Payment Run", href: "/lenders/print-statements", icon: Send },
      { label: "Print Checks", href: "/lenders/print-checks", icon: Printer },
      { label: "ACH Report", href: "/reports/lender/ach-payments", icon: Banknote },
      { label: "Check Register", href: "/lenders/check-register", icon: ClipboardList },
    ],
  },
  {
    label: "Vendors",
    href: "/vendors",
    icon: Truck,
    children: [
      { label: "Add New", href: "/vendors/new", icon: UserPlus },
      { label: "New Invoice", href: "/vendors/new-invoice", icon: ReceiptText },
      { label: "Print Checks", href: "/vendors/print-checks", icon: Printer },
      { label: "Check Register", href: "/vendors/check-register", icon: ClipboardList },
      { label: "Statements", href: "/vendors/statements", icon: ScrollText },
    ],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
    children: [
      { label: "Borrower", href: "/reports/borrower", icon: Users },
      { label: "Lender", href: "/reports/lender", icon: Landmark },
      { label: "Vendor", href: "/reports/vendor", icon: Truck },
      { label: "Loan", href: "/reports/loan", icon: HandCoins },
      { label: "Accounting", href: "/reports/accounting", icon: Calculator },
    ],
  },
  {
    label: "Notices",
    href: "/notices",
    icon: Bell,
    children: [
      { label: "Borrower", href: "/notices/borrower", icon: Users },
      { label: "Lender", href: "/notices/lender", icon: Landmark },
      { label: "Vendor", href: "/notices/vendor", icon: Truck },
      { label: "Template Builder", href: "/notices/template-builder", icon: LayoutTemplate },
    ],
  },
  { label: "Deed Dashboard", href: "/documents", icon: FileSignature },
  { label: "Tax Forms", href: "/tax-forms", icon: Receipt },
  { label: "Tax Bill Processing", href: "/tax-bill-processing", icon: FileSpreadsheet },
  { label: "Escrow Maintenance", href: "/escrow-maintenance", icon: PiggyBank },
  {
    label: "Setup",
    href: "/setup",
    icon: Settings,
    children: [
      { label: "Users", href: "/setup/users", icon: UserCog },
      { label: "GL Codes", href: "/setup/gl-codes", icon: Hash },
      { label: "Bank Accounts", href: "/setup/bank-accounts", icon: Building2 },
    ],
  },
];

function isPathActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar({ isSuperUser = false }: { isSuperUser?: boolean }) {
  const pathname = usePathname();
  const navItems = isSuperUser
    ? [...NAV_ITEMS, { label: "Program Customization", href: "/program-customization", icon: Sparkles }]
    : NAV_ITEMS;

  return (
    <nav className="w-60 shrink-0 border-r border-slate-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900 print:hidden">
      <div className="rounded-md bg-white px-4 py-5">
        <CompanyLogo className="h-8" />
        <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500">Land Contract Servicing</p>
      </div>
      <GlobalSearchBox />
      <ul className="space-y-0.5 px-2 pb-4">
        {navItems.map((item) => {
          const isActive =
            isPathActive(pathname, item.href) || (item.children?.some((c) => isPathActive(pathname, c.href)) ?? false);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm dark:bg-neutral-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
                }`}
              >
                <Icon size={16} className="shrink-0" />
                {item.label}
              </Link>
              {item.children && isActive && (
                <ul className="mt-0.5 ml-3 space-y-0.5 border-l border-slate-200 pl-3 dark:border-neutral-700">
                  {item.children.map((child) => {
                    const isChildActive = pathname === child.href;
                    const ChildIcon = child.icon;
                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                            isChildActive
                              ? "bg-slate-100 font-medium text-slate-900 dark:bg-neutral-800 dark:text-white"
                              : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-white"
                          }`}
                        >
                          <ChildIcon size={14} className="shrink-0" />
                          {child.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <RecentItems />
    </nav>
  );
}
