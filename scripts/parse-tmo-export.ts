import fs from "node:fs";
import { parse } from "csv-parse/sync";

/**
 * Parses The Mortgage Office's "Loan Master Report" export, a printed report
 * dumped to CSV: one account per multi-page block at FIXED column positions.
 * This is NOT a normal tabular CSV, so parsing is anchored on section header
 * rows (e.g. "LOAN TERMS") rather than a fixed row-per-record shape.
 *
 * Two export paths produce slightly different column layouts for the SAME
 * report: a direct CSV export, and an XLSX export (opened/re-saved through
 * Excel, then converted back to CSV) — the latter compresses a handful of
 * genuinely-empty padding columns that existed only for print alignment in
 * the original. Confirmed empirically against the exact same account
 * present in both a direct-CSV export and an XLSX-derived one: the shift is
 * a step function of the ORIGINAL column position, identical across every
 * section (loan terms, borrower, property, both ledgers, lender
 * assignment): columns <=11 are unchanged, columns 12-20 shift by +1,
 * columns >=21 shift by +3. detectLayout() below picks the right mapping
 * once per file by checking a reliable anchor ("TIN:"), so every column
 * reference in this file is written as the ORIGINAL (direct-CSV) index and
 * passed through `col()` — never a raw literal.
 */

function layoutShiftForXlsxExport(oldCol: number): number {
  if (oldCol <= 11) return oldCol;
  if (oldCol <= 20) return oldCol + 1;
  return oldCol + 3;
}

type ColumnMapper = (oldCol: number) => number;

function detectLayout(rows: string[][]): ColumnMapper {
  for (const row of rows) {
    const idx = row.findIndex((c) => c?.trim() === "TIN:");
    if (idx === -1) continue;
    if (idx === 30) return (col) => col; // direct CSV export — native layout
    if (idx === 33) return layoutShiftForXlsxExport; // XLSX-derived export
    throw new Error(
      `Unrecognized column layout: "TIN:" label found at column ${idx}, expected 30 (direct CSV export) or 33 (XLSX-derived export). This file's export path may differ from both known cases — column offsets need to be re-verified before parsing it.`
    );
  }
  throw new Error('Could not detect column layout: no "TIN:" label found anywhere in the file.');
}

export interface ParsedTransaction {
  transactionDate: string | null;
  paymentDueDate: string | null;
  reference: string | null;
  description: string | null;
  transactionAmount: string | null;
  interestDistribution: string | null;
  principalDistribution: string | null;
  lateCharges: string | null;
  other: string | null;
  reserve: string | null;
  impound: string | null;
  principalBalance: string | null;
}

export interface ParsedTrustActivity {
  transactionDate: string | null;
  reference: string | null;
  toWhomPaidOrFromWhomReceived: string | null;
  description: string | null;
  amountPaidOut: string | null;
  amountReceived: string | null;
  balance: string | null;
}

export interface ParsedLenderAssignment {
  lenderAccount: string | null; // short payee code, e.g. "GLOBALPM"
  lenderName: string | null;
  pctOwned: string | null;
  regularPayment: string | null;
  brokerFeePctOfPrin: string | null;
  brokerFeePlusAmt: string | null;
  // This business always configures the flat fee here (pct and plus-amt left
  // at 0), so this column is the effective flat broker servicing fee.
  brokerFeeMinimum: string | null;
}

export interface ParsedBorrower {
  name: string | null;
  borrowerType: string | null; // "Primary" | "Co"
  addressLine1: string | null;
  cityStateZip: string | null;
  ssnLast4: string | null; // full TIN is discarded immediately, never retained
  email: string | null;
  phoneHome: string | null;
  phoneWork: string | null;
  phoneCell: string | null;
}

export interface ParsedAccount {
  accountNumber: string;
  reportDate: string | null;
  borrowers: ParsedBorrower[];
  property: {
    description: string | null;
    address: string | null;
    cityStateZip: string | null;
    propertyType: string | null;
    occupancy: string | null;
    appraisedValue: string | null;
    ltv: string | null;
  } | null;
  loanTerms: {
    originalAmount: string | null;
    principalBalance: string | null;
    loanType: string | null;
    amortizationType: string | null;
    noteRatePercent: string | null;
    rateType: string | null;
    priority: string | null;
    closingDate: string | null;
    firstPaymentDate: string | null;
    purchaseDate: string | null;
    interestPaidToDate: string | null;
    paymentAmount: string | null; // "P & I"
    nextPaymentDate: string | null;
    trustImpound: string | null;
    maturityDate: string | null;
    paidOffDate: string | null;
    lateChargeAmount: string | null;
    graceDays: string | null;
    minimumLateFee: string | null;
    paymentAdjustmentStatus: string | null; // "Active" | "Paid"
  } | null;
  transactions: ParsedTransaction[];
  trustActivity: ParsedTrustActivity[];
  lenderAssignments: ParsedLenderAssignment[];
  warnings: string[];
}

function cell(row: string[] | undefined, idx: number): string | null {
  const v = row?.[idx];
  return v && v.trim() !== "" ? v.trim() : null;
}

function findRowIndex(rows: string[][], start: number, end: number, labelCol: number, label: string): number | null {
  for (let i = start; i < end; i++) {
    if (rows[i]?.[labelCol]?.trim() === label) return i;
  }
  return null;
}

function findAllRowIndices(rows: string[][], start: number, end: number, labelCol: number, label: string): number[] {
  const indices: number[] = [];
  for (let i = start; i < end; i++) {
    if (rows[i]?.[labelCol]?.trim() === label) indices.push(i);
  }
  return indices;
}

// Every section header in this report lands at raw column 1 regardless of
// layout (the XLSX column shift only affects columns >=12). Loops that walk
// rows until "the next section" must stop at any of these — otherwise they
// silently consume unrelated rows past a section with no blank/footer
// separator (confirmed happening between borrowers and "ASSIGNMENT OF LOAN
// FUNDING" on several accounts, e.g. 00010).
const SECTION_HEADERS = [
  "PRIMARY BORROWER & CO-BORROWERS INFORMATION",
  "PROPERTY & APPRAISAL INFORMATION",
  "LOAN TERMS",
  "ACCOUNT ACTIVITY",
  "TRUST ACCOUNT ACTIVITY",
  "ASSIGNMENT OF LOAN FUNDING",
];

function isSectionHeaderRow(row: string[] | undefined): boolean {
  const v = row?.[1]?.trim();
  return v !== undefined && SECTION_HEADERS.includes(v);
}

function last4(ssn: string | null): string | null {
  if (!ssn) return null;
  const digits = ssn.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

function parseAccountBlock(rows: string[][], start: number, end: number, accountNumber: string, col: ColumnMapper): ParsedAccount {
  const warnings: string[] = [];

  const reportDateRow = findRowIndex(rows, start, end, col(41), "REPORT DATE") ?? findRowIndex(rows, start, end, 1, "COMPANY");
  const reportDate = reportDateRow !== null ? cell(rows[reportDateRow], col(76)) : null;

  // --- Borrowers ---
  // The "PRIMARY BORROWER & CO-BORROWERS INFORMATION" header can repeat on a
  // later page when a co-borrower's block doesn't fit on the primary's page,
  // so every occurrence must be scanned, not just the first.
  const pbIndices = findAllRowIndices(rows, start, end, 1, "PRIMARY BORROWER & CO-BORROWERS INFORMATION");
  const borrowers: ParsedBorrower[] = [];
  if (pbIndices.length > 0) {
    for (const pbIdx of pbIndices) {
      let r = pbIdx + 1;
      // Each borrower occupies a 4-row block. Keep reading blocks while a name
      // cell (col 1) is present; stop at the footer row, a blank name, or the
      // start of the next section (no blank separator row is guaranteed).
      while (
        r < end &&
        cell(rows[r], 1) !== null &&
        cell(rows[r], 1) !== "Powered by The Mortgage Office™" &&
        !isSectionHeaderRow(rows[r])
      ) {
        const nameRow = rows[r];
        const row2 = rows[r + 1];
        const row3 = rows[r + 2];
        const fullTin = cell(nameRow, col(36));
        borrowers.push({
          name: cell(nameRow, 1),
          addressLine1: cell(nameRow, col(16)),
          cityStateZip: cell(row2, col(16)),
          borrowerType: cell(nameRow, col(47)),
          ssnLast4: last4(fullTin),
          email: cell(row2, col(47)),
          phoneHome: cell(nameRow, col(66)),
          phoneWork: cell(row2, col(66)),
          phoneCell: cell(row3, col(66)),
        });
        r += 4;
      }
    }
  } else {
    warnings.push("No PRIMARY BORROWER & CO-BORROWERS INFORMATION section found");
  }

  // --- Property ---
  const paIdx = findRowIndex(rows, start, end, 1, "PROPERTY & APPRAISAL INFORMATION");
  const property = paIdx !== null
    ? {
        description: cell(rows[paIdx + 1], col(4)),
        address: cell(rows[paIdx + 2], col(4)),
        cityStateZip: cell(rows[paIdx + 3], col(4)),
        propertyType: cell(rows[paIdx + 1], col(34)),
        occupancy: cell(rows[paIdx + 2], col(34)),
        appraisedValue: cell(rows[paIdx + 3], col(74)),
        ltv: cell(rows[paIdx + 2], col(74)),
      }
    : null;
  if (!property) warnings.push("No PROPERTY & APPRAISAL INFORMATION section found");

  // --- Loan terms ---
  const ltIdx = findRowIndex(rows, start, end, 1, "LOAN TERMS");
  let loanTerms: ParsedAccount["loanTerms"] = null;
  if (ltIdx !== null) {
    // Row offsets from the "LOAN TERMS" header row (offset 0), confirmed
    // against real export rows: +1 sub-header row, +2 blank/N-A row, then
    // data rows start at +3 (see import-data/README.md).
    const r = (offset: number) => rows[ltIdx + offset];
    loanTerms = {
      originalAmount: cell(r(3), col(10)),
      principalBalance: cell(r(3), col(21)),
      loanType: cell(r(3), col(64)),
      amortizationType: cell(r(4), col(64)),
      noteRatePercent: cell(r(5), col(10)),
      rateType: cell(r(5), col(64)),
      priority: cell(r(7), col(10)),
      closingDate: cell(r(9), col(10)),
      firstPaymentDate: cell(r(10), col(10)),
      purchaseDate: cell(r(11), col(10)),
      interestPaidToDate: cell(r(13), col(10)),
      paymentAmount: cell(r(13), col(21)),
      nextPaymentDate: cell(r(14), col(10)),
      trustImpound: cell(r(15), col(21)),
      // "Payment Adjustment:" value sits in an irregular column — search the row.
      paymentAdjustmentStatus: r(15)?.find((c) => c === "Active" || c === "Paid") ?? null,
      maturityDate: cell(r(16), col(10)),
      paidOffDate: cell(r(17), col(10)),
      lateChargeAmount: cell(r(18), col(10)),
      graceDays: cell(r(19), col(10)),
      minimumLateFee: cell(r(20), col(10)),
    };
  } else {
    warnings.push("No LOAN TERMS section found");
  }

  // --- Transaction ledger (spans possibly multiple pages within this account's row range) ---
  const transactions: ParsedTransaction[] = [];
  for (let i = start; i < end; i++) {
    if (rows[i]?.[1]?.trim() === "ACCOUNT ACTIVITY") {
      // Data rows start 3 below the section header (2 header rows in between),
      // and continue until a blank row / footer / next section.
      let r = i + 3;
      while (r < end) {
        const row = rows[r];
        const txDate = cell(row, 1);
        const desc = cell(row, col(13));
        const isBlank = row.every((c) => !c || c.trim() === "");
        if (isBlank || cell(row, 1) === "Powered by The Mortgage Office™") break;
        if (txDate === "Balance Forward" || (txDate === null && desc === "Balance Forward")) {
          r++;
          continue;
        }
        // Skip stray section/header repeats if a new page restarted the table
        if (cell(row, 1) === "Transaction " || cell(row, 1) === "Date") {
          r++;
          continue;
        }
        // A real transaction row always has a MM/DD/YYYY date in this column.
        // Anything else here (e.g. "TRUST ACCOUNT ACTIVITY", "OUTSTANDING
        // CHARGES AND ADVANCES") means the table ended and a new section
        // started — stop rather than misreading its differently-shaped rows
        // as more ledger transactions.
        if (!txDate || !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(txDate)) break;
        transactions.push({
          transactionDate: cell(row, 1),
          paymentDueDate: cell(row, col(4)),
          reference: cell(row, col(8)),
          description: cell(row, col(13)),
          transactionAmount: cell(row, col(30)),
          interestDistribution: cell(row, col(37)),
          principalDistribution: cell(row, col(43)),
          lateCharges: cell(row, col(49)),
          other: cell(row, col(56)),
          reserve: cell(row, col(62)),
          impound: cell(row, col(67)),
          principalBalance: cell(row, col(74)),
        });
        r++;
      }
    }
  }
  if (transactions.length === 0) warnings.push("No transaction rows parsed");

  // --- Trust account activity (escrow: tax authority payments, insurance
  // transfers, borrower payment credits into the impound sub-account) ---
  const trustActivity: ParsedTrustActivity[] = [];
  for (let i = start; i < end; i++) {
    if (rows[i]?.[1]?.trim() === "TRUST ACCOUNT ACTIVITY") {
      let r = i + 3; // 2 header rows, then "Balance Forward" (skipped below)
      while (r < end) {
        const row = rows[r];
        const txDate = cell(row, 1);
        const isBlank = row.every((c) => !c || c.trim() === "");
        if (isBlank || cell(row, 1) === "Powered by The Mortgage Office™") break;
        if (cell(row, col(31)) === "Balance Forward") {
          r++;
          continue;
        }
        if (cell(row, 1) === "Transaction " || cell(row, 1) === "Date") {
          r++;
          continue;
        }
        // Same guard as the payment ledger: a real row always starts with a
        // MM/DD/YYYY date; anything else means a new section began (e.g.
        // "OUTSTANDING CHARGES AND ADVANCES").
        if (!txDate || !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(txDate)) break;
        trustActivity.push({
          transactionDate: cell(row, 1),
          reference: cell(row, col(5)),
          toWhomPaidOrFromWhomReceived: cell(row, col(11)),
          description: cell(row, col(31)),
          amountPaidOut: cell(row, col(59)),
          amountReceived: cell(row, col(66)),
          balance: cell(row, col(74)),
        });
        r++;
      }
    }
  }

  // --- Lender assignment (who funds this loan, at what %, and their fee) ---
  const lenderAssignments: ParsedLenderAssignment[] = [];
  const alfIdx = findRowIndex(rows, start, end, 1, "ASSIGNMENT OF LOAN FUNDING");
  if (alfIdx !== null) {
    let r = alfIdx + 3; // 2 sub-header rows, then data rows
    while (r < end) {
      const row = rows[r];
      const lenderAccount = cell(row, 1);
      const lenderName = cell(row, col(6));
      // The final row in this table is a totals summary (no lender identity)
      // — stop there rather than treating it as another assignment.
      if (!lenderAccount && !lenderName) break;
      const isBlank = row.every((c) => !c || c.trim() === "");
      if (isBlank || cell(row, 1) === "Powered by The Mortgage Office™") break;
      lenderAssignments.push({
        lenderAccount,
        lenderName,
        pctOwned: cell(row, col(22)),
        regularPayment: cell(row, col(35)),
        brokerFeePctOfPrin: cell(row, col(39)),
        brokerFeePlusAmt: cell(row, col(45)),
        brokerFeeMinimum: cell(row, col(50)),
      });
      r++;
    }
  }
  if (lenderAssignments.length === 0) warnings.push("No lender assignment found");

  return { accountNumber, reportDate, borrowers, property, loanTerms, transactions, trustActivity, lenderAssignments, warnings };
}

export function parseFile(filePath: string): ParsedAccount[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const rows: string[][] = parse(content, { relax_column_count: true, skip_empty_lines: false });

  const col = detectLayout(rows);

  // Find every footer row (marks the end of a page) and its account number.
  const footers: { rowIndex: number; accountNumber: string }[] = [];
  rows.forEach((row, idx) => {
    if (row[1]?.trim() === "Powered by The Mortgage Office™") {
      const acctCell = row.find((c) => c?.startsWith("Account: "));
      const accountNumber = acctCell ? acctCell.replace("Account: ", "").trim() : "UNKNOWN";
      footers.push({ rowIndex: idx, accountNumber });
    }
  });

  // Group consecutive footers with the same account number into one block;
  // the block's row range runs from just after the previous account's last
  // footer (or 0) through this account's last footer.
  const accounts: ParsedAccount[] = [];
  let blockStart = 0;
  for (let i = 0; i < footers.length; i++) {
    const isLastFooterForAccount = i === footers.length - 1 || footers[i + 1].accountNumber !== footers[i].accountNumber;
    if (isLastFooterForAccount) {
      const blockEnd = footers[i].rowIndex + 1;
      accounts.push(parseAccountBlock(rows, blockStart, blockEnd, footers[i].accountNumber, col));
      blockStart = blockEnd;
    }
  }

  return accounts;
}

// Only run the CLI when this file is executed directly (e.g. `tsx
// scripts/parse-tmo-export.ts ...`), not when imported as a module by
// another script (e.g. the DB importer, which reuses parseFile()).
const isMainModule = process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/parse-tmo-export.ts") ?? false;
if (isMainModule) {
  runCli();
}

function runCli() {
const filePath = process.argv[2];
const mode = process.argv[3];
if (!filePath) {
  console.error("Usage: tsx scripts/parse-tmo-export.ts <path-to-csv> [--summary]");
  process.exit(1);
}

const accounts = parseFile(filePath);
console.log(`Parsed ${accounts.length} accounts.\n`);

if (mode === "--summary") {
  const statusCounts: Record<string, number> = {};
  let totalTransactions = 0;
  let missingLoanTerms = 0;
  let missingProperty = 0;
  let missingBorrower = 0;
  let noTransactions = 0;
  let multiBorrower = 0;
  let totalTrustActivity = 0;
  let noTrustActivity = 0;
  const payeeCounts: Record<string, number> = {};
  const priorities: Record<string, number> = {};
  const lenderNameCounts: Record<string, number> = {};
  let multiLenderAccounts = 0;
  let noLenderAssignment = 0;
  let nonFlatBrokerFee = 0;
  for (const acct of accounts) {
    const status = acct.loanTerms?.paymentAdjustmentStatus ?? "UNKNOWN";
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    totalTransactions += acct.transactions.length;
    totalTrustActivity += acct.trustActivity.length;
    if (acct.trustActivity.length === 0) noTrustActivity++;
    if (!acct.loanTerms) missingLoanTerms++;
    if (!acct.property) missingProperty++;
    if (acct.borrowers.length === 0) missingBorrower++;
    if (acct.transactions.length === 0) noTransactions++;
    if (acct.borrowers.length > 1) multiBorrower++;
    const p = acct.loanTerms?.priority ?? "UNKNOWN";
    priorities[p] = (priorities[p] ?? 0) + 1;
    for (const t of acct.trustActivity) {
      if (t.amountPaidOut && t.toWhomPaidOrFromWhomReceived) {
        payeeCounts[t.toWhomPaidOrFromWhomReceived] = (payeeCounts[t.toWhomPaidOrFromWhomReceived] ?? 0) + 1;
      }
    }
    if (acct.lenderAssignments.length === 0) noLenderAssignment++;
    if (acct.lenderAssignments.length > 1) multiLenderAccounts++;
    for (const l of acct.lenderAssignments) {
      if (l.lenderName) lenderNameCounts[l.lenderName] = (lenderNameCounts[l.lenderName] ?? 0) + 1;
      const pctFee = l.brokerFeePctOfPrin?.replace("%", "").trim();
      const plusAmt = l.brokerFeePlusAmt;
      if ((pctFee && pctFee !== "0.000") || (plusAmt && plusAmt !== "$0.00")) nonFlatBrokerFee++;
    }
  }
  console.log("Status counts:", statusCounts);
  console.log("Priority counts:", priorities);
  console.log("Total transactions across all accounts:", totalTransactions);
  console.log("Total trust activity rows across all accounts:", totalTrustActivity);
  console.log("Accounts with zero trust activity rows:", noTrustActivity);
  console.log("Accounts with >1 borrower:", multiBorrower);
  console.log("Accounts missing loan terms:", missingLoanTerms);
  console.log("Accounts missing property section:", missingProperty);
  console.log("Accounts missing borrower:", missingBorrower);
  console.log("Accounts with zero transactions:", noTransactions);
  const topPayees = Object.entries(payeeCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log("\nTop 15 trust-activity disbursement payees (by row count):");
  topPayees.forEach(([name, count]) => console.log(` - ${name}: ${count}`));

  console.log(`\nDistinct lenders across all accounts: ${Object.keys(lenderNameCounts).length}`);
  console.log("Accounts with no lender assignment found:", noLenderAssignment);
  console.log("Accounts with >1 lender (fractional ownership):", multiLenderAccounts);
  console.log("Lender assignments where broker fee isn't purely flat (pct or plus-amt nonzero):", nonFlatBrokerFee);
  const topLenders = Object.entries(lenderNameCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log("\nTop 15 lenders (by number of loans funded):");
  topLenders.forEach(([name, count]) => console.log(` - ${name}: ${count}`));
  const allWarnings = accounts.flatMap((a) => a.warnings.map((w) => `${a.accountNumber}: ${w}`));
  console.log(`\nWarnings (${allWarnings.length}):`);
  allWarnings.slice(0, 40).forEach((w) => console.log(" -", w));
  process.exit(0);
}

for (const acct of accounts) {
  console.log(`=== Account ${acct.accountNumber} ===`);
  console.log(
    "Borrowers:",
    acct.borrowers.map((b) => `${b.name} (${b.borrowerType}, SSN ...${b.ssnLast4 ?? "????"})`).join("; ")
  );
  console.log("Property:", acct.property?.address, acct.property?.cityStateZip);
  console.log("Loan terms:", JSON.stringify(acct.loanTerms, null, 2));
  console.log(`Transactions: ${acct.transactions.length} rows`);
  console.log("First 3:", JSON.stringify(acct.transactions.slice(0, 3), null, 2));
  console.log("Last 3:", JSON.stringify(acct.transactions.slice(-3), null, 2));
  if (acct.warnings.length) console.log("WARNINGS:", acct.warnings);
  console.log();
}
}
