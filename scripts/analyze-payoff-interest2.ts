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

const accounts = parseFile(process.argv[2]);
const errors: number[] = [];
let matched = 0, total = 0;

for (const acct of accounts) {
  if (!acct.loanTerms?.noteRatePercent) continue;
  const rate = new Decimal(acct.loanTerms.noteRatePercent.replace("%", ""));
  if (rate.isZero()) continue;

  let priorBalanceCents: number | null = null;
  let lastDueDate: Date | null = null;

  for (const t of acct.transactions) {
    if (t.description === "Payoff") {
      const payoffDate = mdyToDate(t.transactionDate);
      const interestCharged = moneyToCents(t.interestDistribution);
      if (payoffDate && lastDueDate && priorBalanceCents !== null && interestCharged !== null && interestCharged > 0) {
        const days = daysBetween(lastDueDate, payoffDate) + 1; // inclusive
        if (days > 0 && days < 60) {
          const est = new Decimal(priorBalanceCents).mul(rate).div(100).div(365).mul(days)
            .toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
          const err = Math.abs(est - interestCharged);
          errors.push(err);
          total++;
          if (err <= 100) matched++; // within $1
        }
      }
    }
    const balAfter = moneyToCents(t.principalBalance);
    if (balAfter !== null) priorBalanceCents = balAfter;
    const due = mdyToDate(t.paymentDueDate);
    if (due) lastDueDate = due;
  }
}

const avg = errors.reduce((a, b) => a + b, 0) / errors.length / 100;
const max = Math.max(...errors) / 100;
console.log(`Payoff per-diem test (actual/365, days = lastDueDate->payoffDate inclusive):`);
console.log(`  n=${total}, matched within $1: ${matched}/${total}, avg error $${avg.toFixed(3)}, max error $${max.toFixed(2)}`);
