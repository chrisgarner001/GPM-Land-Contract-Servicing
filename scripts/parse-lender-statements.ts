import fs from "node:fs";
import { parse } from "csv-parse/sync";

/**
 * Parses The Mortgage Office's "Lender Statement of Account" export — same
 * fixed-column, print-style report family as parse-vendor-statements.ts and
 * parse-check-register.ts, but one block per LENDER (investor funding these
 * land contracts) rather than per vendor/check.
 *
 * Confirmed against the real 24,590-line export: 74 lender blocks, 15,185
 * ACCOUNT ACTIVITY rows across 324 header occurrences (multi-page lenders
 * reprint the section header + 2-line column header roughly every 18 rows —
 * handled the same way as the vendor-statement parser: read from
 * headerIdx+3, stop at the first row whose date column doesn't match
 * MM/DD/YYYY, and repeat for the next header occurrence).
 *
 * Column mapping for ACCOUNT ACTIVITY (verified two ways: (1) the two-line
 * wrapped header labels appear in this left-to-right order — Serv. Fees,
 * Interest, Principal, Charges, Other, Trust — matching these 6 numeric data
 * columns in the same order; (2) empirically, for every single one of the
 * 15,185 real data rows, servicingFee + interestDistribution +
 * principalDistribution + charges + other + trust sums EXACTLY to
 * transactionAmount (verified to the cent, zero mismatches). The report also
 * contains unrelated sections whose rows also start with a date in column 1
 * (FUNDING ACTIVITY, CHECKS SCHEDULED TO BE PRINTED, OUTSTANDING CHARGES AND
 * ADVANCES) — those use entirely different column layouts and MUST NOT be
 * confused with ACCOUNT ACTIVITY rows; this parser only ever reads rows
 * anchored to an "ACCOUNT ACTIVITY" section header, never a bare date-regex
 * scan of the whole file.
 *
 * Column indices in the parsed (0-based) row array, confirmed stable:
 *   1  = Transaction Date
 *   4  = Check# or Reference
 *   8  = Loan Account (almost always 5 digits, e.g. "00035"; a handful of
 *        6-7 digit / non-numeric outliers exist — e.g. "GOODALL" — kept as
 *        free text, not assumed numeric)
 *   17 = Transaction Amount
 *   21 = Serv. Fees
 *   26 = Interest (distribution)
 *   30 = Principal (distribution)
 *   33 = Charges
 *   38 = Other
 *   42 = Trust (distribution) — in practice always $0.00 except one observed
 *        outlier row with no Loan Account at all ("SGMS CREDI" reference)
 */

export interface ParsedLenderTransaction {
  transactionDate: string | null;
  reference: string | null;
  loanAccount: string | null;
  transactionAmount: string | null;
  servicingFee: string | null;
  interestDistribution: string | null;
  principalDistribution: string | null;
  charges: string | null;
  other: string | null;
  trust: string | null;
}

export interface ParsedLender {
  lenderAccountCode: string;
  displayName: string;
  state: string | null;
  transactions: ParsedLenderTransaction[];
  warnings: string[];
}

function cell(row: string[] | undefined, idx: number): string | null {
  const v = row?.[idx];
  return v && v.trim() !== "" ? v.trim() : null;
}

function isBlankRow(row: string[] | undefined): boolean {
  if (!row) return true;
  return row.every((c) => !c || c.trim() === "");
}

function findAllRowIndices(rows: string[][], start: number, end: number, col: number, label: string): number[] {
  const indices: number[] = [];
  for (let i = start; i < end; i++) {
    if (rows[i]?.[col]?.trim() === label) indices.push(i);
  }
  return indices;
}

const DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;

function parseLenderBlock(rows: string[][], start: number, end: number): ParsedLender {
  const warnings: string[] = [];

  // --- ACCOUNT NO ---
  let lenderAccountCode = "";
  for (let i = start; i < end; i++) {
    if (rows[i]?.[30]?.trim() === "ACCOUNT NO") {
      lenderAccountCode = cell(rows[i], 42) ?? "";
      break;
    }
  }
  if (!lenderAccountCode) warnings.push("No ACCOUNT NO found for this lender block");

  // --- LENDER name / state ---
  let displayName = "";
  let state: string | null = null;
  const lenderHeaderIdx = (() => {
    for (let i = start; i < end; i++) {
      if (rows[i]?.[1]?.trim() === "LENDER") return i;
    }
    return null;
  })();

  if (lenderHeaderIdx !== null) {
    let r = lenderHeaderIdx + 1;
    while (r < end && isBlankRow(rows[r])) r++;
    displayName = cell(rows[r], 1) ?? "";
    r++;
    while (r < end && isBlankRow(rows[r])) r++;
    state = cell(rows[r], 1);
  } else {
    warnings.push("No LENDER section found");
  }
  if (!displayName) warnings.push("No lender display name found");

  // --- ACCOUNT ACTIVITY (repeats across page breaks within one block) ---
  const transactions: ParsedLenderTransaction[] = [];
  const activityHeaderIndices = findAllRowIndices(rows, start, end, 1, "ACCOUNT ACTIVITY");
  for (const headerIdx of activityHeaderIndices) {
    let r = headerIdx + 3; // 2 column-label rows below the section header
    while (r < end) {
      const row = rows[r];
      const txDate = cell(row, 1);
      if (!txDate || !DATE_RE.test(txDate)) break;
      transactions.push({
        transactionDate: txDate,
        reference: cell(row, 4),
        loanAccount: cell(row, 8),
        transactionAmount: cell(row, 17),
        servicingFee: cell(row, 21),
        interestDistribution: cell(row, 26),
        principalDistribution: cell(row, 30),
        charges: cell(row, 33),
        other: cell(row, 38),
        trust: cell(row, 42),
      });
      r++;
    }
  }
  if (transactions.length === 0) warnings.push("No ACCOUNT ACTIVITY transactions parsed");

  return { lenderAccountCode, displayName, state, transactions, warnings };
}

export function parseLenderStatements(filePath: string): ParsedLender[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const rows: string[][] = parse(content, { relax_column_count: true, skip_empty_lines: false });

  const blockStarts = findAllRowIndices(rows, 0, rows.length, 0, "LENDER STATEMENT OF ACCOUNT");
  const lenders: ParsedLender[] = [];
  for (let i = 0; i < blockStarts.length; i++) {
    const start = blockStarts[i];
    const end = i + 1 < blockStarts.length ? blockStarts[i + 1] : rows.length;
    lenders.push(parseLenderBlock(rows, start, end));
  }
  return lenders;
}

function isMainModule(): boolean {
  return require.main === module;
}

if (isMainModule()) {
  const filePath = process.argv[2] ?? "import-data/lender_statements.csv";
  const lenders = parseLenderStatements(filePath);
  const totalTransactions = lenders.reduce((s, l) => s + l.transactions.length, 0);
  const withWarnings = lenders.filter((l) => l.warnings.length > 0);
  console.log(`Parsed ${lenders.length} lenders, ${totalTransactions} total transactions.`);
  console.log(`Lenders with warnings: ${withWarnings.length}`);
  withWarnings.forEach((l) => console.log(` - ${l.lenderAccountCode || "(unknown)"} / ${l.displayName || "(unknown)"}:`, l.warnings));
  console.log("\nSample lender:", JSON.stringify({ ...lenders[0], transactions: lenders[0].transactions.slice(0, 3) }, null, 2));
}
