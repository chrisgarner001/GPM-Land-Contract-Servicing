import fs from "node:fs";
import { parse } from "csv-parse/sync";

/**
 * Parses TMO's "Borrower Name & Address Listing" export — a different shape
 * than the other print-style reports: one borrower per FIXED 4-row label
 * block (First Name/Last Name/MI/Account in column 2, Home/Work/Cell/Fax in
 * column 9), anchored on "First Name:" in column 2. The label rows are
 * always exactly 4 rows regardless of address length; what varies is the
 * name+address column (0), which holds the display name, then 1-2 address
 * lines, then a "City ST ZIP" line — confirmed against the file: most
 * borrowers have a 1-line street address (address ends at row+3, same row
 * as "Account:"), but some have a second address line (e.g. a PO Box), which
 * pushes the "City ST ZIP" line to row+4, one row past the fixed label
 * block. Anchoring on "First Name:" (not a fixed row-count per record) is
 * what makes this correct for both cases.
 *
 * Page breaks reprint "BORROWER NAME & ADDRESS LISTING" + company/date lines
 * after a "Powered by The Mortgage Office..." footer — skipped like the
 * other parsers, since a fresh "First Name:" anchor after the footer just
 * resumes normally.
 */

export interface ParsedBorrower {
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  middleInitial: string | null;
  accountNumber: string | null;
  homePhone: string | null;
  workPhone: string | null;
  cellPhone: string | null;
  faxPhone: string | null;
  addressLines: string[];
  city: string | null;
  state: string | null;
  zip: string | null;
}

function cell(row: string[] | undefined, idx: number): string | null {
  const v = row?.[idx];
  return v && v.trim() !== "" ? v.trim() : null;
}

const CITY_STATE_ZIP_RE = /^(.+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/;

export function parseBorrowerListing(filePath: string): ParsedBorrower[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const rows: string[][] = parse(content, { relax_column_count: true, skip_empty_lines: false });

  const borrowers: ParsedBorrower[] = [];
  let i = 0;
  while (i < rows.length) {
    if (cell(rows[i], 2) !== "First Name:") {
      i++;
      continue;
    }
    const start = i;
    const displayName = cell(rows[start], 0) ?? "";
    const firstName = cell(rows[start], 4);
    const lastName = cell(rows[start + 1], 4);
    const middleInitial = cell(rows[start + 2], 4);
    const accountNumber = cell(rows[start + 3], 4);
    const homePhone = cell(rows[start], 10);
    const workPhone = cell(rows[start + 1], 10);
    const cellPhone = cell(rows[start + 2], 10);
    const faxPhone = cell(rows[start + 3], 10);

    const addressLines: string[] = [];
    let city: string | null = null;
    let state: string | null = null;
    let zip: string | null = null;
    let r = start + 2;
    while (r < rows.length) {
      const text = cell(rows[r], 0);
      if (!text) break;
      const m = CITY_STATE_ZIP_RE.exec(text);
      if (m) {
        city = m[1];
        state = m[2];
        zip = m[3];
        r++;
        break;
      }
      addressLines.push(text);
      r++;
    }

    borrowers.push({
      displayName,
      firstName,
      lastName,
      middleInitial,
      accountNumber,
      homePhone,
      workPhone,
      cellPhone,
      faxPhone,
      addressLines,
      city,
      state,
      zip,
    });
    i = r;
  }
  return borrowers;
}

function isMainModule(): boolean {
  return require.main === module;
}

if (isMainModule()) {
  const filePath = process.argv[2] ?? "import-data/borrower_listing.csv";
  const borrowers = parseBorrowerListing(filePath);
  console.log(`Parsed ${borrowers.length} borrowers.`);
  console.log(JSON.stringify(borrowers.slice(0, 3), null, 2));
  const noAccount = borrowers.filter((b) => !b.accountNumber);
  console.log(`Borrowers with no account number: ${noAccount.length}`);
}
