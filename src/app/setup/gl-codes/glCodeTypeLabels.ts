// Matches QuickBooks' own account type vocabulary (see the real chart of
// accounts import) — CURRENT_ASSET/CURRENT_LIABILITY still exist in the DB
// enum for backward compatibility but are intentionally omitted here.
export const GL_CODE_TYPE_LABELS: Record<string, string> = {
  BANK: "Bank",
  OTHER_CURRENT_ASSET: "Other Current Asset",
  FIXED_ASSET: "Fixed Asset",
  OTHER_ASSET: "Other Asset",
  CREDIT_CARD: "Credit Card",
  OTHER_CURRENT_LIABILITY: "Other Current Liability",
  LONG_TERM_LIABILITY: "Long Term Liability",
  EQUITY: "Equity",
  INCOME: "Income",
  COST_OF_GOODS_SOLD: "Cost of Goods Sold",
  EXPENSE: "Expense",
  OTHER_INCOME: "Other Income",
  OTHER_EXPENSE: "Other Expense",
};

export const GL_CODE_TYPE_OPTIONS = Object.entries(GL_CODE_TYPE_LABELS).map(([value, label]) => ({ value, label }));
