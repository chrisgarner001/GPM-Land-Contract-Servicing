import fs from "node:fs";
import { parse } from "csv-parse/sync";

/**
 * Parses The Mortgage Office's "Vendor Statement of Account" export — the
 * same fixed-column, print-style report family as the Loan Master Report
 * (parse-tmo-export.ts), but one block per VENDOR (insurance carrier, tax
 * authority, title company, attorney, etc.) rather than per loan. Confirmed
 * against the real export: single consistent column layout throughout (no
 * XLSX-round-trip shift like the Loan Master Report needed), 148 vendor
 * blocks, ~13.7k ACCOUNT ACTIVITY disbursement rows, zero blank Loan Account
 * values.
 */

export interface ParsedVendorTransaction {
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

export interface ParsedVendor {
  vendorAccountCode: string;
  displayName: string;
  referenceLine: string | null;
  addressLine1: string | null;
  cityStateZip: string | null;
  transactions: ParsedVendorTransaction[];
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

function parseVendorBlock(rows: string[][], start: number, end: number): ParsedVendor {
  const warnings: string[] = [];

  let vendorAccountCode = "";
  for (let i = start; i < end; i++) {
    if (rows[i]?.[19]?.trim() === "ACCOUNT NO.") {
      vendorAccountCode = cell(rows[i], 28) ?? "";
      break;
    }
  }
  if (!vendorAccountCode) warnings.push("No ACCOUNT NO. found for this vendor block");

  // --- VENDOR name/reference/address ---
  const vendorHeaderIdx = (() => {
    for (let i = start; i < end; i++) {
      if (rows[i]?.[1]?.trim() === "VENDOR") return i;
    }
    return null;
  })();

  let displayName = "";
  let referenceLine: string | null = null;
  let addressLine1: string | null = null;
  let cityStateZip: string | null = null;

  if (vendorHeaderIdx !== null) {
    let r = vendorHeaderIdx + 1;
    while (r < end && isBlankRow(rows[r])) r++;
    displayName = cell(rows[r], 1) ?? "";
    r++;
    if (cell(rows[r], 1)?.startsWith("Re:")) {
      referenceLine = cell(rows[r], 1);
      r++;
    }
    const addressLines: string[] = [];
    while (r < end && !isBlankRow(rows[r])) {
      const line = cell(rows[r], 1);
      if (line) addressLines.push(line);
      r++;
    }
    addressLine1 = addressLines[0] ?? null;
    cityStateZip = addressLines.length > 1 ? addressLines[addressLines.length - 1] : null;
  } else {
    warnings.push("No VENDOR section found");
  }

  // --- ACCOUNT ACTIVITY (can repeat across page breaks within one block) ---
  const transactions: ParsedVendorTransaction[] = [];
  const activityHeaderIndices = findAllRowIndices(rows, start, end, 1, "ACCOUNT ACTIVITY");
  for (const headerIdx of activityHeaderIndices) {
    let r = headerIdx + 3; // 2 column-label rows below the section header
    while (r < end) {
      const row = rows[r];
      const txDate = cell(row, 1);
      if (!txDate || !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(txDate)) break;
      transactions.push({
        transactionDate: txDate,
        reference: cell(row, 4),
        loanAccount: cell(row, 7),
        transactionAmount: cell(row, 10),
        servicingFee: cell(row, 13),
        interestDistribution: cell(row, 16),
        principalDistribution: cell(row, 20),
        charges: cell(row, 22),
        other: cell(row, 25),
        trust: cell(row, 28),
      });
      r++;
    }
  }
  if (transactions.length === 0) warnings.push("No ACCOUNT ACTIVITY transactions parsed");

  return { vendorAccountCode, displayName, referenceLine, addressLine1, cityStateZip, transactions, warnings };
}

export function parseVendorStatements(filePath: string): ParsedVendor[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const rows: string[][] = parse(content, { relax_column_count: true, skip_empty_lines: false });

  const blockStarts = findAllRowIndices(rows, 0, rows.length, 0, "VENDOR STATEMENT OF ACCOUNT");
  const vendors: ParsedVendor[] = [];
  for (let i = 0; i < blockStarts.length; i++) {
    const start = blockStarts[i];
    const end = i + 1 < blockStarts.length ? blockStarts[i + 1] : rows.length;
    vendors.push(parseVendorBlock(rows, start, end));
  }
  return vendors;
}

function isMainModule(): boolean {
  return require.main === module;
}

if (isMainModule()) {
  const filePath = process.argv[2] ?? "import-data/vendor_statements.csv";
  const vendors = parseVendorStatements(filePath);
  const totalTransactions = vendors.reduce((s, v) => s + v.transactions.length, 0);
  const withWarnings = vendors.filter((v) => v.warnings.length > 0);
  console.log(`Parsed ${vendors.length} vendors, ${totalTransactions} total transactions.`);
  console.log(`Vendors with warnings: ${withWarnings.length}`);
  withWarnings.slice(0, 20).forEach((v) => console.log(` - ${v.vendorAccountCode || "(unknown)"}:`, v.warnings));
  console.log("\nSample vendor:", JSON.stringify(vendors[0], null, 2).slice(0, 800));
}
