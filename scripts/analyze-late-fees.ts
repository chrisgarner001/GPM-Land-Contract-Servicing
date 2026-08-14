import { parseFile } from "./parse-tmo-export";

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
const lateFeeAmounts: Record<string, number> = {};
let checkedGrace = 0, graceRespected = 0;
const graceViolations: string[] = [];

for (const acct of accounts) {
  const graceDays = acct.loanTerms?.graceDays ? Number(acct.loanTerms.graceDays) : null;
  // Find each Late Charge row and the payment row immediately before it (same date, shares reference)
  for (let i = 0; i < acct.transactions.length; i++) {
    const t = acct.transactions[i];
    if (t.description === "Late Charge" && t.transactionAmount) {
      const amt = t.transactionAmount.replace(/[(),$]/g, "");
      lateFeeAmounts[amt] = (lateFeeAmounts[amt] ?? 0) + 1;
      // Find the payment this late charge is attached to: same reference, earlier in the list, has a due/received date
      const linkedPayment = acct.transactions.slice(0, i).reverse().find((p) => p.reference === t.reference && p.paymentDueDate);
      if (linkedPayment?.paymentDueDate && linkedPayment.transactionDate && graceDays !== null) {
        const due = mdyToDate(linkedPayment.paymentDueDate);
        const received = mdyToDate(linkedPayment.transactionDate);
        if (due && received) {
          const daysLate = daysBetween(due, received);
          checkedGrace++;
          if (daysLate > graceDays) graceRespected++;
          else graceViolations.push(`${acct.accountNumber}: late fee charged but only ${daysLate} days late (grace=${graceDays})`);
        }
      }
    }
  }
}

console.log("Distinct late-charge amounts seen (amount: count):");
Object.entries(lateFeeAmounts).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([amt, c]) => console.log(`  $${amt}: ${c}`));
console.log(`\nGrace-period check: ${checkedGrace} late charges matched to a payment with a due date.`);
console.log(`Charged after grace period elapsed: ${graceRespected}/${checkedGrace}`);
console.log(`Apparent violations (charged within grace): ${graceViolations.length}`);
graceViolations.slice(0, 10).forEach((v) => console.log("  -", v));
