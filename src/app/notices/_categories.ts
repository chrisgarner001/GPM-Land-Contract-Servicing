import type { CategoryTabItem } from "../_components/CategoryTabs";

// Notices diverges from Reports here: Template Builder replaces Loan (no
// loan-wide notices exist), so this can't reuse CategoryTabs' default list.
// icon is a name key (see CategoryTabs.tsx) — this module is imported by
// Server Component pages and passed as a prop into a Client Component, so
// it must stay plain serializable data, not live icon component references.
export const NOTICES_TAB_CATEGORIES: CategoryTabItem[] = [
  { label: "Borrower", segment: "borrower", icon: "Users" },
  { label: "Lender", segment: "lender", icon: "Landmark" },
  { label: "Vendor", segment: "vendor", icon: "Truck" },
  { label: "Template Builder", segment: "template-builder", icon: "LayoutTemplate" },
];
