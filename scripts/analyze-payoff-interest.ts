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
function addMonthsUTC(d: Date, months: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

const filePath = process.argv[2];
const accounts = parseFile(filePath);

let n = 0;
const results: { errFromDue365: number; errFromDuePlus1mo365: number; errFromLastTx365: number }[] = [];

for (const acct of accounts) {
  if (!acct.loanTerms?.noteRatePercent) continue;
  const rate = new Decimal(acct.loanTerms.noteRatePercent.replace("%", ""));
  if (rate.isZero()) continue;

  let priorBalanceCents: number | null = null;
  let lastDueDate: Date | null = null;
  let lastTxDate: Date | null = null;

  for (const t of acct.transactions) {
    if (t.description === "Payoff") {
      const payoffDate = mdyToDate(t.transactionDate);
      const interestCharged = moneyToCents(t.interestDistribution);
      if (payoffDate && priorBalanceCents !== null && interestCharged !== null && interestCharged > 0) {
        const balance = new Decimal(priorBalanceCents);
        const dailyRate365 = rate.div(100).div(365);

        const computeErr = (startDate: Date | null) => {
          if (!startDate) return null;
          const days = daysBetween(startDate, payoffDate);
          if (days <= 0 || days > 90) return null;
          const est = balance.mul(dailyRate365).mul(days).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
          return Math.abs(est - interestCharged);
        };

        const errFromDue365 = computeErr(lastDueDate);
        const errFromDuePlus1mo365 = computeErr(lastDueDate ? addMonthsUTC(lastDueDate, 1) : null);
        const errFromLastTx365 = computeErr(lastTxDate);

        if (errFromDue365 !== null || errFromDuePlus1mo365 !== null || errFromLastTx365 !== null) {
          results.push({
            errFromDue365: errFromDue365 ?? -1,
            errFromDuePlus1mo365: errFromDuePlus1mo365 ?? -1,
            errFromLastTx365: errFromLastTx365 ?? -1,
          });
          n++;
        }
      }
    }
    const balAfter = moneyToCents(t.principalBalance);
    if (balAfter !== null) priorBalanceCents = balAfter;
    const due = mdyToDate(t.paymentDueDate);
    if (due) lastDueDate = due;
    const tx = mdyToDate(t.transactionDate);
    if (tx) lastTxDate = tx;
  }
}

function stats(vals: number[]) {
  const valid = vals.filter((v) => v >= 0);
  if (valid.length === 0) return "no valid samples";
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length / 100;
  const max = Math.max(...valid) / 100;
  const within1 = valid.filter((v) => v <= 100).length;
  return `n=${valid.length}, avg=$${avg.toFixed(2)}, max=$${max.toFixed(2)}, within $1: ${within1}/${valid.length}`;
}

console.log(`Payoff rows analyzed: ${n}`);
console.log("From last payment DUE date, actual/365:      ", stats(results.map((r) => r.errFromDue365)));
console.log("From last DUE date + 1 month, actual/365:     ", stats(results.map((r) => r.errFromDuePlus1mo365)));
console.log("From last payment RECEIVED date, actual/365:  ", stats(results.map((r) => r.errFromLastTx365)));
