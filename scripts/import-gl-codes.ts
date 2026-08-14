/**
 * Replaces gl_codes with the business's real QuickBooks chart of accounts
 * (G:\Shared drives\SGMS\New LC Servicing Program\AccountList (1).pdf,
 * pulled 2026-08-05). QuickBooks itself has no numeric account codes, so the
 * `code` values here are a fresh numbering scheme assigned to match QB's own
 * account Type grouping and order:
 *   1000s Bank, 1100s Other Current Asset, 1200s Fixed Asset, 1300s Other Asset,
 *   2000s Credit Card, 2100s Other Current Liability, 2200s Long Term Liability,
 *   3000s Equity, 4000s Income, 5000s Cost of Goods Sold, 6000s Expense,
 *   8000s Other Income, 9000s Other Expense.
 * Sub-accounts (QB's "Parent:Child" names) get the parent's code + a suffix
 * digit (e.g. 6100 Insurance Expenses, 6101 Insurance Expenses:Insurance-Business).
 *
 * The previous 15 rows were placeholder/sample data (generic descriptions
 * like "Cash / Checking Account"), not the real chart — safe to replace
 * wholesale since contract_charges.glCode / vendor_disbursements.glCode are
 * free-text fields, not foreign keys into this table.
 *
 * Usage: npx tsx scripts/import-gl-codes.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function run() {
  const { db } = await import("../src/db/client");
  const { glCodes } = await import("../src/db/schema/setup");
  const { sql } = await import("drizzle-orm");

  const accounts: { code: string; description: string; type: string }[] = [
    // Bank
    { code: "1000", description: "5/3 BUSINESS Escrow CHECKING (3387) - 3", type: "BANK" },
    { code: "1010", description: "5/3 BUSINESS Lender Trust CHECKING (3379) - 3", type: "BANK" },
    { code: "1020", description: "5/3 OPERATING ACCT (3361) - 3", type: "BANK" },
    // Other Current Assets
    { code: "1100", description: "Health Insurance Reimbursement", type: "OTHER_CURRENT_ASSET" },
    { code: "1110", description: "Inventory Asset", type: "OTHER_CURRENT_ASSET" },
    { code: "1120", description: "Payroll Corrections", type: "OTHER_CURRENT_ASSET" },
    { code: "1130", description: "Payroll Refunds", type: "OTHER_CURRENT_ASSET" },
    { code: "1140", description: "Purchaser Monthly Payments", type: "OTHER_CURRENT_ASSET" },
    { code: "1150", description: "QuickBooks Tax Holding Account", type: "OTHER_CURRENT_ASSET" },
    { code: "1160", description: "Uncategorized Asset", type: "OTHER_CURRENT_ASSET" },
    { code: "1170", description: "Undeposited Funds", type: "OTHER_CURRENT_ASSET" },
    // Fixed Assets
    { code: "1200", description: "113 W Exchange St", type: "FIXED_ASSET" },
    { code: "1210", description: "Accumulated Depreciation", type: "FIXED_ASSET" },
    { code: "1220", description: "Furniture & Fixtures", type: "FIXED_ASSET" },
    { code: "1230", description: "Furniture and Equipment", type: "FIXED_ASSET" },
    { code: "1240", description: "Hawaii Home Office Purchase", type: "FIXED_ASSET" },
    { code: "1250", description: "House Purchase", type: "FIXED_ASSET" },
    { code: "1260", description: "House Purchase Improvements", type: "FIXED_ASSET" },
    { code: "1270", description: "Land - 113 W Exchange St", type: "FIXED_ASSET" },
    { code: "1280", description: "Leasehold Improvements", type: "FIXED_ASSET" },
    // Other Assets
    { code: "1300", description: "Loans", type: "OTHER_ASSET" },
    // Credit Card
    { code: "2000", description: "SGMS AmEx", type: "CREDIT_CARD" },
    // Other Current Liabilities
    { code: "2100", description: "Client Trust- Pass through", type: "OTHER_CURRENT_LIABILITY" },
    { code: "2105", description: "Direct Deposit Payable", type: "OTHER_CURRENT_LIABILITY" },
    { code: "2110", description: "Escrow payable", type: "OTHER_CURRENT_LIABILITY" },
    { code: "2115", description: "Loan Payable", type: "OTHER_CURRENT_LIABILITY" },
    { code: "2116", description: "Loan Payable:Aaron Cox", type: "OTHER_CURRENT_LIABILITY" },
    { code: "2117", description: "Loan Payable:Jim Woodworth", type: "OTHER_CURRENT_LIABILITY" },
    { code: "2120", description: "Michigan Department of Treasury Payable", type: "OTHER_CURRENT_LIABILITY" },
    { code: "2125", description: "Out Of Scope Agency Payable", type: "OTHER_CURRENT_LIABILITY" },
    { code: "2130", description: "Owner Payments", type: "OTHER_CURRENT_LIABILITY" },
    { code: "2135", description: "Payable to Clients", type: "OTHER_CURRENT_LIABILITY" },
    { code: "2140", description: "Payroll Liabilities", type: "OTHER_CURRENT_LIABILITY" },
    { code: "2141", description: "Payroll Liabilities:CA PIT / SDI", type: "OTHER_CURRENT_LIABILITY" },
    { code: "2142", description: "Payroll Liabilities:Federal Taxes (941/944)", type: "OTHER_CURRENT_LIABILITY" },
    { code: "2143", description: "Payroll Liabilities:Federal Unemployment (940)", type: "OTHER_CURRENT_LIABILITY" },
    { code: "2144", description: "Payroll Liabilities:Health Insurance Reimbursement", type: "OTHER_CURRENT_LIABILITY" },
    { code: "2145", description: "Payroll Liabilities:HI Income Tax", type: "OTHER_CURRENT_LIABILITY" },
    { code: "2146", description: "Payroll Liabilities:MI Income Tax", type: "OTHER_CURRENT_LIABILITY" },
    { code: "2147", description: "Payroll Liabilities:MI Unemployment Tax", type: "OTHER_CURRENT_LIABILITY" },
    { code: "2148", description: "Payroll Liabilities:Simple IRA", type: "OTHER_CURRENT_LIABILITY" },
    { code: "2150", description: "Short Term Loan", type: "OTHER_CURRENT_LIABILITY" },
    // Long Term Liabilities
    { code: "2200", description: "Land Contract - 113 W Exchange St", type: "LONG_TERM_LIABILITY" },
    { code: "2210", description: "Loan - Hawaii House", type: "LONG_TERM_LIABILITY" },
    { code: "2220", description: "Loan from Daniel Williams and Diane Cutler", type: "LONG_TERM_LIABILITY" },
    { code: "2230", description: "Loan from Walden", type: "LONG_TERM_LIABILITY" },
    { code: "2240", description: "Loan From Zuchowski", type: "LONG_TERM_LIABILITY" },
    // Equity
    { code: "3000", description: "Capital Stock", type: "EQUITY" },
    { code: "3010", description: "Equity - Aaron", type: "EQUITY" },
    { code: "3020", description: "Equity - Annie", type: "EQUITY" },
    { code: "3030", description: "Equity - Jimmy", type: "EQUITY" },
    { code: "3040", description: "Equity - SGI", type: "EQUITY" },
    { code: "3050", description: "Insurance Claim", type: "EQUITY" },
    { code: "3060", description: "Opening Balance Equity", type: "EQUITY" },
    { code: "3070", description: "Retained Earnings", type: "EQUITY" },
    { code: "3080", description: "Shareholder Distributions", type: "EQUITY" },
    // Income
    { code: "4000", description: "Billable Expense Income", type: "INCOME" },
    { code: "4001", description: "Billable Expense Income ( 64 )", type: "INCOME" },
    { code: "4010", description: "House Sale", type: "INCOME" },
    { code: "4020", description: "Payment Fees Income", type: "INCOME" },
    { code: "4030", description: "Sales - Broker Commission", type: "INCOME" },
    { code: "4040", description: "Sales of Product Income", type: "INCOME" },
    { code: "4050", description: "Sales- Commission", type: "INCOME" },
    { code: "4060", description: "Sales- Land Contract Commission Income", type: "INCOME" },
    { code: "4070", description: "Sales-LC Servicing Fees", type: "INCOME" },
    // Cost of Goods Sold
    { code: "5000", description: "Cost of Goods Sold", type: "COST_OF_GOODS_SOLD" },
    // Expenses
    { code: "6000", description: "Advertising and Promotion", type: "EXPENSE" },
    { code: "6010", description: "Automobile Expense", type: "EXPENSE" },
    { code: "6020", description: "Business Promotions", type: "EXPENSE" },
    { code: "6030", description: "Computer and Software Expenses", type: "EXPENSE" },
    { code: "6040", description: "Contracted Services", type: "EXPENSE" },
    { code: "6050", description: "Credit Card Rewards (cash back/ statement credit)", type: "EXPENSE" },
    { code: "6060", description: "Depreciation Expense", type: "EXPENSE" },
    { code: "6070", description: "Employee Gift", type: "EXPENSE" },
    { code: "6080", description: "Gift/Donations", type: "EXPENSE" },
    { code: "6090", description: "HI Payroll Taxes", type: "EXPENSE" },
    { code: "6100", description: "Insurance Expenses", type: "EXPENSE" },
    { code: "6101", description: "Insurance Expenses:Insurance - Business", type: "EXPENSE" },
    { code: "6102", description: "Insurance Expenses:Insurance-Liability", type: "EXPENSE" },
    { code: "6103", description: "Insurance Expenses:Insurance-Building", type: "EXPENSE" },
    { code: "6110", description: "Interest Expense", type: "EXPENSE" },
    { code: "6120", description: "IRA Contributions", type: "EXPENSE" },
    { code: "6130", description: "Legal & Professional Fees", type: "EXPENSE" },
    { code: "6140", description: "Licensing Fees and Expenses", type: "EXPENSE" },
    { code: "6150", description: "Loan costs", type: "EXPENSE" },
    { code: "6151", description: "Loan costs:Appraisals", type: "EXPENSE" },
    { code: "6152", description: "Loan costs:BS&A Expense", type: "EXPENSE" },
    { code: "6153", description: "Loan costs:Credit Reports", type: "EXPENSE" },
    { code: "6154", description: "Loan costs:Earnest Money Deposit", type: "EXPENSE" },
    { code: "6155", description: "Loan costs:MERS Corp expense", type: "EXPENSE" },
    { code: "6160", description: "Meals 100% deductible", type: "EXPENSE" },
    { code: "6161", description: "Meals 50% deductible", type: "EXPENSE" },
    { code: "6162", description: "Meals NOT deductible", type: "EXPENSE" },
    { code: "6170", description: "Membership/Dues/Subscriptions", type: "EXPENSE" },
    { code: "6180", description: "Office Supplies", type: "EXPENSE" },
    { code: "6190", description: "Other Miscellaneous Business Expenses", type: "EXPENSE" },
    { code: "6200", description: "Payroll Expenses", type: "EXPENSE" },
    { code: "6201", description: "Payroll Expenses:Company Contributions", type: "EXPENSE" },
    { code: "6202", description: "Payroll Expenses:Company Contributions:Health Insurance", type: "EXPENSE" },
    { code: "6203", description: "Payroll Expenses:Company Contributions:Retirement", type: "EXPENSE" },
    { code: "6204", description: "Payroll Expenses:Taxes", type: "EXPENSE" },
    { code: "6205", description: "Payroll Expenses:Wages", type: "EXPENSE" },
    { code: "6210", description: "Professional Fees", type: "EXPENSE" },
    { code: "6220", description: "Property Management - GPM", type: "EXPENSE" },
    { code: "6230", description: "Property Taxes", type: "EXPENSE" },
    { code: "6240", description: "Purchases", type: "EXPENSE" },
    { code: "6250", description: "Rent Expense", type: "EXPENSE" },
    { code: "6260", description: "Repairs and Maintenance", type: "EXPENSE" },
    { code: "6270", description: "Service Charges", type: "EXPENSE" },
    { code: "6280", description: "Shipping / Postage", type: "EXPENSE" },
    { code: "6290", description: "Taxes Paid", type: "EXPENSE" },
    { code: "6300", description: "Telephone Expense", type: "EXPENSE" },
    { code: "6310", description: "Travel Expense", type: "EXPENSE" },
    { code: "6320", description: "Tuition/Education", type: "EXPENSE" },
    { code: "6330", description: "Uncategorized Expense", type: "EXPENSE" },
    { code: "6340", description: "Utilities", type: "EXPENSE" },
    // Other Income
    { code: "8000", description: "Interest Earned", type: "OTHER_INCOME" },
    { code: "8010", description: "Rental Income", type: "OTHER_INCOME" },
    // Other Expense
    { code: "9000", description: "Ask My Accountant", type: "OTHER_EXPENSE" },
    { code: "9010", description: "Reconciliation Discrepancies", type: "OTHER_EXPENSE" },
  ];

  const apply = process.argv.includes("--apply");
  console.log(`Parsed ${accounts.length} accounts.`);
  if (!apply) {
    console.log("Dry run — pass --apply to write. First 5:", accounts.slice(0, 5));
    return;
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`DELETE FROM gl_codes`);
    for (const a of accounts) {
      await tx.insert(glCodes).values({ code: a.code, description: a.description, type: a.type as (typeof glCodes.$inferInsert)["type"] });
    }
  });
  console.log(`Replaced gl_codes with ${accounts.length} real accounts.`);
}

run();
