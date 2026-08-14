import fs from "node:fs";
import { parse } from "csv-parse/sync";

/**
 * Parses The Mortgage Office's "LENDER NAME & ADDRESS LISTING" export.
 * Despite the title, TMO prints ALL name/address contacts (real lenders,
 * vendors, insurance companies, law offices, etc.) under this single mislabeled
 * report — there is no field distinguishing party type. Confirmed against the
 * real 1217-line export (20 pages, one repeating page header, no separate
 * vendor section).
 *
 * Each contact is a variable-length block anchored on the row where col2 ==
 * "First Name:", running up to (but not including) the next such row.
 * Within a block, the "Last Name:"/"MI:"/"Account:" label rows are located by
 * scanning col2 rather than assumed fixed offsets — confirmed necessary
 * because some blocks (e.g. multiple "ETC Custodian FBO" sub-accounts) insert
 * an extra blank row between "First Name:" and "Last Name:", shifting
 * everything that follows. Column mapping within any label row: col0 = an
 * address line (independent of the row's own label), col4 = the label's
 * value, col10 = a phone number (Home/Work/Cell/Fax per row).
 *
 * Address text is every non-empty col0 across the whole block (including the
 * label rows' own col0, and any trailing wrap rows with no label at all),
 * excluding repeating page-break boilerplate (footer + reprinted header) that
 * appears at every page boundary. Some blocks (insurance vendors) have a
 * "Re: Policy #..." memo as their first address line — kept as part of the
 * street text since these never match a real lender party during import.
 */

export interface ParsedAddressRecord {
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  middleInitial: string | null;
  accountCode: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  homePhone: string | null;
  workPhone: string | null;
  cellPhone: string | null;
  faxPhone: string | null;
}

function cell(row: string[] | undefined, idx: number): string | null {
  const v = row?.[idx];
  return v && v.trim() !== "" ? v.trim() : null;
}

const CITY_STATE_ZIP_RE = /^(.+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/;

// Repeating page-break boilerplate (footer + reprinted header) that appears
// between records at every page boundary — must never be read as address text.
const PAGE_BREAK_MARKER_RE = /^Powered by The Mortgage Office|^LENDER NAME & ADDRESS LISTING|^Success Group Mortgage & Servicing|^\w+day, \w+ \d{1,2}, \d{4}$/;

function splitAddress(lines: string[]): { addressLine1: string | null; city: string | null; state: string | null; zip: string | null } {
  const nonEmpty = lines.map((l) => l.trim()).filter((l) => l !== "");
  if (nonEmpty.length === 0) return { addressLine1: null, city: null, state: null, zip: null };

  const last = nonEmpty[nonEmpty.length - 1];
  const match = CITY_STATE_ZIP_RE.exec(last);
  if (match) {
    const street = nonEmpty.slice(0, -1).join(", ");
    return { addressLine1: street || null, city: match[1], state: match[2], zip: match[3] };
  }
  // No recognizable "City ST ZIP" line (e.g. a lone state abbreviation like
  // "MI", or a bare memo line) — keep everything as street text.
  return { addressLine1: nonEmpty.join(", "), city: null, state: null, zip: null };
}

function findLabelRow(rows: string[][], start: number, end: number, label: string): number | null {
  for (let r = start; r < end; r++) {
    if (rows[r]?.[2]?.trim() === label) return r;
  }
  return null;
}

export function parseVendorLenderAddresses(filePath: string): ParsedAddressRecord[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const rows: string[][] = parse(content, { relax_column_count: true, skip_empty_lines: false });

  const starts: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]?.[2]?.trim() === "First Name:") starts.push(i);
  }

  const records: ParsedAddressRecord[] = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : rows.length;

    const displayName = cell(rows[start], 0) ?? "";
    const firstName = cell(rows[start], 4);
    const homePhone = cell(rows[start], 10);

    const lastNameRow = findLabelRow(rows, start + 1, end, "Last Name:");
    const lastName = cell(rows[lastNameRow ?? -1], 4);
    const workPhone = cell(rows[lastNameRow ?? -1], 10);

    const miRow = findLabelRow(rows, start + 1, end, "MI:");
    const middleInitial = cell(rows[miRow ?? -1], 4);
    const cellPhone = cell(rows[miRow ?? -1], 10);

    const accountRow = findLabelRow(rows, start + 1, end, "Account:");
    const accountCode = cell(rows[accountRow ?? -1], 4);
    const faxPhone = cell(rows[accountRow ?? -1], 10);

    const addressLines: string[] = [];
    for (let r = start + 1; r < end; r++) {
      const text = cell(rows[r], 0);
      if (!text) continue;
      if (PAGE_BREAK_MARKER_RE.test(text)) break;
      addressLines.push(text);
    }
    const { addressLine1, city, state, zip } = splitAddress(addressLines);

    records.push({
      displayName,
      firstName,
      lastName,
      middleInitial,
      accountCode,
      addressLine1,
      city,
      state,
      zip,
      homePhone,
      workPhone,
      cellPhone,
      faxPhone,
    });
  }

  return records;
}

function isMainModule(): boolean {
  return require.main === module;
}

if (isMainModule()) {
  const filePath = process.argv[2] ?? "import-data/vendor_lender_address.csv";
  const records = parseVendorLenderAddresses(filePath);
  console.log(`Parsed ${records.length} records.`);
  console.log("\nSample records:", JSON.stringify(records.slice(0, 5), null, 2));
  const noZip = records.filter((r) => !r.zip);
  console.log(`\nRecords with no recognizable city/state/zip: ${noZip.length}`);
  noZip.slice(0, 15).forEach((r) => console.log(` - ${r.displayName}: addressLine1=${JSON.stringify(r.addressLine1)}`));
}
