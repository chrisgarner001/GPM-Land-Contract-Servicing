import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatCents, formatDate } from "@/lib/format";

// Prints ONLY the variable data onto blank "voucher check" stock (stub on
// top, check on the bottom third) — confirmed against real specimens for
// the Owner Trust and Escrow accounts (G:\Shared drives\SGMS\New LC
// Servicing Program\Check Sample *.pdf): company name/address, bank
// name/logo, fractional routing number, and the MICR line (routing +
// account + check number) are all pre-printed/pre-encoded on the physical
// stock — this renderer never touches those. It only fills in: the stub's
// per-line-item table, the stub's summary line, and the check's Date /
// Check No. / Amount / Pay-to-the-order-of.
//
// Coordinates below are a first-pass estimate from the scanned specimens,
// not yet calibrated against a real printer/stock alignment — print one
// test page on blank paper, hold it up to a real check, and adjust the
// offsets in LAYOUT below as needed (they're in points from the top-left,
// converted internally to pdf-lib's bottom-left origin).
const PAGE_WIDTH = 612; // 8.5in
const PAGE_HEIGHT = 792; // 11in
const IN = 72;
const LINES_PER_INCH = 6; // standard print-line convention (as used in check-alignment feedback)

// Calibration offset from real test prints: down 4 lines was too far, up 2
// lines from there — net 2 lines down. Positive = down (toward the bottom
// of the page).
const VERTICAL_OFFSET_IN = 2 / LINES_PER_INCH;

function fromTop(inches: number): number {
  return PAGE_HEIGHT - (inches + VERTICAL_OFFSET_IN) * IN;
}

const LAYOUT = {
  stub: {
    tableTop: 0.75 - 2 / LINES_PER_INCH, // first body row's top edge, inches from page top — tightened two lines per test-print feedback
    rowHeight: 0.26,
    maxRows: 14,
    columns: {
      loanNo: { x: 0.1, width: 0.75 },
      borrowerName: { x: 0.9, width: 1.4 },
      dateDue: { x: 2.35, width: 0.65 },
      totalPayment: { x: 3.05, width: 0.85 },
      fees: { x: 3.95, width: 0.7 },
      interest: { x: 4.7, width: 0.7 },
      principal: { x: 5.45, width: 1.0 },
      other: { x: 6.5, width: 0.7 },
      principalBal: { x: 7.25, width: 1.15 },
    },
  },
  summaryRow: {
    y: 5.1,
    columns: {
      checkNo: { x: 0.1 },
      counselor: { x: 1.3 },
      investorNo: { x: 2.1 },
      checkDate: { x: 3.0 },
      checkAmount: { x: 3.9 },
      ytdInterest: { x: 4.85 },
    },
  },
  check: {
    checkNoBox: { x: 0.35, y: 8.75 },
    date: { x: 6.45, y: 8.7 },
    amount: { x: 7.25, y: 8.7 },
    amountWords: { x: 1.7, y: 8.75 }, // same line as Check No./Date
    payee: { x: 1.0, y: 9.65 + 1 / LINES_PER_INCH }, // one line lower, per test-print feedback
  },
};

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const SCALES = ["", "Thousand", "Million", "Billion"];

function threeDigitsToWords(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ""));
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(" ");
}

function integerToWords(n: number): string {
  if (n === 0) return "Zero";
  const groups: string[] = [];
  let scale = 0;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk > 0) groups.unshift(`${threeDigitsToWords(chunk)}${SCALES[scale] ? ` ${SCALES[scale]}` : ""}`);
    n = Math.floor(n / 1000);
    scale++;
  }
  return groups.join(" ");
}

// Standard check convention: dollars spelled out, cents as "xx/100".
export function amountToWords(amountCents: number): string {
  const dollars = Math.floor(amountCents / 100);
  const cents = amountCents % 100;
  return `${integerToWords(dollars)} and ${String(cents).padStart(2, "0")}/100`;
}

export interface CheckStubLineItem {
  loanNo: string;
  borrowerName: string;
  dateDue: string | null;
  totalPaymentCents: number;
  feesCents: number;
  interestCents: number;
  principalCents: number;
  otherCents: number;
  principalBalCents: number | null;
}

export interface CheckPrintData {
  checkNumber: string;
  checkDate: string;
  payeeName: string;
  amountCents: number;
  counselor?: string;
  investorNo?: string;
  ytdInterestCents?: number;
  lineItems: CheckStubLineItem[];
}

export async function buildCheckPdf(checksToPrint: CheckPrintData[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const check of checksToPrint) {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const draw = (text: string, xIn: number, yInFromTop: number, opts?: { size?: number; bold?: boolean; align?: "left" | "right" }) => {
      const size = opts?.size ?? 8;
      const useFont = opts?.bold ? bold : font;
      let x = xIn * IN;
      if (opts?.align === "right") {
        x -= useFont.widthOfTextAtSize(text, size);
      }
      page.drawText(text, { x, y: fromTop(yInFromTop), size, font: useFont, color: rgb(0, 0, 0) });
    };

    // Stub: per-line-item rows.
    const { tableTop, rowHeight, columns } = LAYOUT.stub;
    check.lineItems.slice(0, LAYOUT.stub.maxRows).forEach((item, i) => {
      const y = tableTop + i * rowHeight + 0.16;
      draw(item.loanNo, columns.loanNo.x, y);
      draw(item.borrowerName, columns.borrowerName.x, y);
      draw(item.dateDue ? formatDate(item.dateDue) : "", columns.dateDue.x, y);
      draw(formatCents(item.totalPaymentCents), columns.totalPayment.x, y);
      draw(formatCents(item.feesCents), columns.fees.x, y);
      draw(formatCents(item.interestCents), columns.interest.x, y);
      draw(formatCents(item.principalCents), columns.principal.x, y);
      draw(formatCents(item.otherCents), columns.other.x, y);
      draw(item.principalBalCents != null ? formatCents(item.principalBalCents) : "", columns.principalBal.x, y);
    });

    // Stub: summary line.
    const sy = LAYOUT.summaryRow.y;
    const sc = LAYOUT.summaryRow.columns;
    draw(check.checkNumber, sc.checkNo.x, sy);
    draw(check.counselor ?? "", sc.counselor.x, sy);
    draw(check.investorNo ?? "", sc.investorNo.x, sy);
    draw(formatDate(check.checkDate), sc.checkDate.x, sy);
    draw(formatCents(check.amountCents), sc.checkAmount.x, sy);
    draw(check.ytdInterestCents != null ? formatCents(check.ytdInterestCents) : "", sc.ytdInterest.x, sy);

    // Check body.
    draw(check.checkNumber, LAYOUT.check.checkNoBox.x, LAYOUT.check.checkNoBox.y, { size: 9 });
    draw(formatDate(check.checkDate), LAYOUT.check.date.x, LAYOUT.check.date.y, { size: 10 });
    draw(formatCents(check.amountCents), LAYOUT.check.amount.x, LAYOUT.check.amount.y, { size: 11, bold: true });
    draw(amountToWords(check.amountCents), LAYOUT.check.amountWords.x, LAYOUT.check.amountWords.y, { size: 10 });
    draw(check.payeeName, LAYOUT.check.payee.x, LAYOUT.check.payee.y, { size: 11 });
  }

  return doc.save();
}
