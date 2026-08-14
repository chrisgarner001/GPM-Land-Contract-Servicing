import fs from "node:fs";
import { parse } from "csv-parse/sync";

/**
 * Parses the INVESTMENT PORTFOLIO and FUNDING ACTIVITY sections of The
 * Mortgage Office's "Lender Statement of Account" export — same
 * fixed-column report family as parse-lender-statements.ts (which
 * deliberately does NOT parse these two sections; see its doc comment).
 *
 * Confirmed against the real 5,361-line "Lender Statement of Account.csv"
 * export: 74 lender blocks. Some larger lenders paginate within their own
 * block (both sections' headers can repeat, e.g. block 51 has 2
 * INVESTMENT PORTFOLIO headers and 3 FUNDING ACTIVITY headers spanning 101
 * total loan rows) — handled the same way parse-lender-statements.ts
 * handles repeated ACCOUNT ACTIVITY headers: find every occurrence of the
 * section header within the block and read rows after each until the data
 * pattern breaks.
 *
 * Column indices in the parsed (0-based) row array, confirmed against real
 * rows for both sections:
 *
 * INVESTMENT PORTFOLIO loan row (indices verified programmatically against
 * the header rows AND the data rows directly — the two-line wrapped header
 * labels do NOT sit in the same column as their data values, e.g. "Pct"/
 * "Owned" prints at col 11 but the "25.000%" value is at col 12; always
 * trust the data-row positions below, confirmed against two real rows):
 *   0  = Loan Account (e.g. "00189")
 *   3  = Borrower Name
 *   12 = Pct Owned (e.g. "25.000%")
 *   13 = Interest Rate (e.g. "8.000%")
 *   15 = Maturity Date
 *   18 = Term Left (months)
 *   19 = Next Payment date
 *   23 = Regular Payment ($)
 *   27 = Loan Balance ($)
 * Ends at the "Current Portfolio Yield: ..." subtotal row (col 0 blank,
 * loan account no longer present) or a blank row.
 *
 * FUNDING ACTIVITY transaction row (same caveat — verified against real
 * data rows, not the header's own column positions):
 *   0  = Transaction Date
 *   2  = Reference (e.g. "TRANSFER")
 *   5  = Loan Account
 *   8  = Borrower Name
 *   27 = Amount Funded ($) — can be negative in parens, e.g. "($100,000.00)"
 *        for a CORRECTION row
 * Ends at the first row whose Transaction Date isn't MM/DD/YYYY (the
 * subtotal row has a blank date).
 */

export interface ParsedInvestmentPortfolioRow {
  loanAccount: string;
  borrowerName: string | null;
  pctOwned: string | null;
  interestRate: string | null;
  maturityDate: string | null;
  termLeftMonths: string | null;
  nextPaymentDate: string | null;
  regularPaymentAmount: string | null;
  loanBalance: string | null;
}

export interface ParsedFundingActivityRow {
  transactionDate: string;
  reference: string | null;
  loanAccount: string | null;
  borrowerName: string | null;
  amountFunded: string | null;
}

export interface ParsedLenderFunding {
  lenderAccountCode: string;
  displayName: string;
  portfolio: ParsedInvestmentPortfolioRow[];
  funding: ParsedFundingActivityRow[];
  warnings: string[];
}

function cell(row: string[] | undefined, idx: number): string | null {
  const v = row?.[idx];
  return v && v.trim() !== "" ? v.trim() : null;
}

function findAllRowIndices(rows: string[][], start: number, end: number, col: number, predicate: (v: string) => boolean): number[] {
  const indices: number[] = [];
  for (let i = start; i < end; i++) {
    const v = rows[i]?.[col]?.trim();
    if (v && predicate(v)) indices.push(i);
  }
  return indices;
}

const DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
const LOAN_ACCOUNT_RE = /^\d+$/;

function parseLenderFundingBlock(rows: string[][], start: number, end: number): ParsedLenderFunding {
  const warnings: string[] = [];

  let lenderAccountCode = "";
  for (let i = start; i < end; i++) {
    if (rows[i]?.[18]?.trim() === "ACCOUNT NO") {
      lenderAccountCode = cell(rows[i], 27) ?? "";
      break;
    }
  }
  if (!lenderAccountCode) warnings.push("No ACCOUNT NO found for this lender block");

  let displayName = "";
  for (let i = start; i < end; i++) {
    if (rows[i]?.[1]?.trim() === "LENDER") {
      let r = i + 1;
      while (r < end && rows[r].every((c) => !c || c.trim() === "")) r++;
      displayName = cell(rows[r], 1) ?? "";
      break;
    }
  }
  if (!displayName) warnings.push("No lender display name found");

  const portfolio: ParsedInvestmentPortfolioRow[] = [];
  const portfolioHeaders = findAllRowIndices(rows, start, end, 0, (v) => v.startsWith("INVESTMENT PORTFOLIO"));
  for (const headerIdx of portfolioHeaders) {
    let r = headerIdx + 3; // 2 wrapped column-label rows below the section header
    while (r < end) {
      const row = rows[r];
      const loanAccount = cell(row, 0);
      if (!loanAccount || !LOAN_ACCOUNT_RE.test(loanAccount)) break;
      portfolio.push({
        loanAccount,
        borrowerName: cell(row, 3),
        pctOwned: cell(row, 12),
        interestRate: cell(row, 13),
        maturityDate: cell(row, 15),
        termLeftMonths: cell(row, 18),
        nextPaymentDate: cell(row, 19),
        regularPaymentAmount: cell(row, 23),
        loanBalance: cell(row, 27),
      });
      r++;
    }
  }
  if (portfolio.length === 0) warnings.push("No INVESTMENT PORTFOLIO rows parsed");

  const funding: ParsedFundingActivityRow[] = [];
  const fundingHeaders = findAllRowIndices(rows, start, end, 0, (v) => v === "FUNDING ACTIVITY");
  for (const headerIdx of fundingHeaders) {
    let r = headerIdx + 3; // 2 wrapped column-label rows below the section header
    while (r < end) {
      const row = rows[r];
      const txDate = cell(row, 0);
      if (!txDate || !DATE_RE.test(txDate)) break;
      funding.push({
        transactionDate: txDate,
        reference: cell(row, 2),
        loanAccount: cell(row, 5),
        borrowerName: cell(row, 8),
        amountFunded: cell(row, 27),
      });
      r++;
    }
  }

  return { lenderAccountCode, displayName, portfolio, funding, warnings };
}

export function parseLenderFunding(filePath: string): ParsedLenderFunding[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const rows: string[][] = parse(content, { relax_column_count: true, skip_empty_lines: false });

  const blockStarts = findAllRowIndices(rows, 0, rows.length, 0, (v) => v === "LENDER STATEMENT OF ACCOUNT");
  const lenders: ParsedLenderFunding[] = [];
  for (let i = 0; i < blockStarts.length; i++) {
    const start = blockStarts[i];
    const end = i + 1 < blockStarts.length ? blockStarts[i + 1] : rows.length;
    lenders.push(parseLenderFundingBlock(rows, start, end));
  }
  return lenders;
}

function isMainModule(): boolean {
  return require.main === module;
}

if (isMainModule()) {
  const filePath = process.argv[2] ?? "G:/Shared drives/SGMS/New LC Servicing Program/Lender Statement of Account.csv";
  const lenders = parseLenderFunding(filePath);
  const totalPortfolioRows = lenders.reduce((s, l) => s + l.portfolio.length, 0);
  const totalFundingRows = lenders.reduce((s, l) => s + l.funding.length, 0);
  const withWarnings = lenders.filter((l) => l.warnings.length > 0);
  console.log(`Parsed ${lenders.length} lenders, ${totalPortfolioRows} portfolio rows, ${totalFundingRows} funding rows.`);
  console.log(`Lenders with warnings: ${withWarnings.length}`);
  withWarnings.forEach((l) => console.log(` - ${l.lenderAccountCode || "(unknown)"} / ${l.displayName || "(unknown)"}:`, l.warnings));
}
