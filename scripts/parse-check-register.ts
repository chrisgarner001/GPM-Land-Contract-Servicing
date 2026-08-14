import fs from "node:fs";
import { parse } from "csv-parse/sync";

/**
 * Parses The Mortgage Office's "Check Register with Detail" export — every
 * check the company wrote, with a header row (check #, date, payee) followed
 * by one or more detail line-items and a subtotal row. Same fixed-column,
 * print-style CSV family as the other TMO exports parsed this session.
 * Confirmed against the real export: exactly 24 fields on every one of its
 * 46,637 rows (no XLSX-shift variant), 4,989 check headers, 28,798 genuine
 * detail line-items. Payees mix vendor, lender, and internal (BROKER/SGMS)
 * codes — kept as free text, not FK'd to any single entity table. Checks
 * span multiple print pages (footer + title + column-header reprints appear
 * mid-check); the parser tracks "current check" state through those and
 * ignores them rather than resetting.
 */

export interface ParsedCheckLineItem {
  loanAccountRaw: string | null;
  amount: string | null;
  servicingFee: string | null;
  interest: string | null;
  principal: string | null;
  lateCharges: string | null;
  chargesAmount: string | null;
  chargesInterest: string | null;
  otherPayments: string | null;
}

export interface ParsedCheck {
  checkNumber: string;
  checkDate: string;
  payeeCode: string;
  payeeName: string;
  totalAmount: string | null;
  lineItems: ParsedCheckLineItem[];
}

function cell(row: string[] | undefined, idx: number): string | null {
  const v = row?.[idx];
  return v && v.trim() !== "" ? v.trim() : null;
}

const DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;

export function parseCheckRegister(filePath: string): ParsedCheck[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const rows: string[][] = parse(content, { relax_column_count: true, skip_empty_lines: false });

  const checks: ParsedCheck[] = [];
  let current: ParsedCheck | null = null;

  for (const row of rows) {
    const col0 = cell(row, 0);
    const col2 = cell(row, 2);
    const col4 = cell(row, 4);

    const isHeaderRow = Boolean(col0 && col4 && col2 && DATE_RE.test(col2));
    if (isHeaderRow) {
      if (current) checks.push(current);
      const [code, ...nameParts] = col4!.split(" - ");
      current = {
        checkNumber: col0!,
        checkDate: col2!,
        payeeCode: code.trim(),
        payeeName: nameParts.join(" - ").trim() || code.trim(),
        totalAmount: null,
        lineItems: [],
      };
      continue;
    }

    // Detail or subtotal row: check-number column blank, but this check is active.
    if (!col0 && current) {
      const amount = cell(row, 6);
      if (!amount) continue; // blank row (page-break spacer, etc.)
      if (!col2) {
        // Subtotal row for the current check (no loan account on it).
        current.totalAmount = amount;
        continue;
      }
      current.lineItems.push({
        loanAccountRaw: col2,
        amount,
        servicingFee: cell(row, 9),
        interest: cell(row, 10),
        principal: cell(row, 13),
        lateCharges: cell(row, 17),
        chargesAmount: cell(row, 18),
        chargesInterest: cell(row, 19),
        otherPayments: cell(row, 22),
      });
    }
    // Otherwise: title/company/reporting-period/footer/column-header noise — skip.
  }
  if (current) checks.push(current);

  return checks;
}

function isMainModule(): boolean {
  return require.main === module;
}

if (isMainModule()) {
  const filePath = process.argv[2] ?? "import-data/check_register.csv";
  const checks = parseCheckRegister(filePath);
  const totalLineItems = checks.reduce((s, c) => s + c.lineItems.length, 0);
  const noTotal = checks.filter((c) => c.totalAmount === null);
  console.log(`Parsed ${checks.length} checks, ${totalLineItems} total line items.`);
  console.log(`Checks with no subtotal row found: ${noTotal.length}`);
  console.log("\nSample check:", JSON.stringify(checks[0], null, 2));
}
