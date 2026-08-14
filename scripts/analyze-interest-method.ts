import { parseFile } from "./parse-tmo-export";
import Decimal from "decimal.js";

function moneyToCents(raw: string | null): number | null {
  if (!raw || raw === "N/A") return null;
  const negative = raw.trim().startsWith("(") && raw.trim().endsWith(")");
  const digits = raw.replace(/[^0-9.]/g, "");
  if (digits === "") return null;
  const cents = new Decimal(digits).mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  return negative ? -cents : cents;
}

function mdyToDate(raw: string | null): Date | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2])));
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

const filePath = process.argv[2];
const accounts = parseFile(filePath);

let count = 0;
let sum360 = 0, sum365 = 0, sum30360 = 0;
let max360 = 0, max365 = 0, max30360 = 0;

for (const acct of accounts) {
  if (!acct.loanTerms?.noteRatePercent) continue;
  const rate = new Decimal(acct.loanTerms.noteRatePercent.replace("%", ""));
  if (rate.isZero()) continue;

  // Only regular "Payment - Thank You" rows, in order, using the PRIOR row's
  // ending principal balance as this row's beginning balance.
  let priorBalanceCents: number | null = null;
  let priorTxDate: Date | null = null;
  for (const t of acct.transactions) {
    const balAfter = moneyToCents(t.principalBalance);
    const interestCents = moneyToCents(t.interestDistribution);
    const txDate = mdyToDate(t.transactionDate);
    const isRegularPayment = t.description === "Payment - Thank You";

    if (isRegularPayment && priorBalanceCents !== null && priorTxDate !== null && txDate && interestCents !== null && interestCents > 0) {
      const days = daysBetween(priorTxDate, txDate);
      if (days > 0 && days < 90) {
        const balance = new Decimal(priorBalanceCents);
        const est360 = balance.mul(rate).div(100).div(360).mul(days).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
        const est365 = balance.mul(rate).div(100).div(365).mul(days).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
        const est30360 = balance.mul(rate).div(100).div(12).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
        sum360 += Math.abs(est360 - interestCents);
        sum365 += Math.abs(est365 - interestCents);
        sum30360 += Math.abs(est30360 - interestCents);
        max360 = Math.max(max360, Math.abs(est360 - interestCents));
        max365 = Math.max(max365, Math.abs(est365 - interestCents));
        max30360 = Math.max(max30360, Math.abs(est30360 - interestCents));
        count++;
      }
    }
    if (balAfter !== null) priorBalanceCents = balAfter;
    if (txDate) priorTxDate = txDate;
  }
}

console.log(`Compared ${count} regular payment rows across ${accounts.length} accounts.`);
console.log(`Actual/360 daily : avg abs error ${(sum360/count/100).toFixed(4)} cents->dollars, max ${(max360/100).toFixed(2)}`);
console.log(`Actual/365 daily : avg abs error ${(sum365/count/100).toFixed(4)} cents->dollars, max ${(max365/100).toFixed(2)}`);
console.log(`30/360 monthly   : avg abs error ${(sum30360/count/100).toFixed(4)} cents->dollars, max ${(max30360/100).toFixed(2)}`);
