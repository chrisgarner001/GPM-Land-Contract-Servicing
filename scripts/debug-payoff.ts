import { parseFile } from "./parse-tmo-export";

const accounts = parseFile(process.argv[2]);
let shown = 0;
for (const acct of accounts) {
  const payoffIdx = acct.transactions.findIndex((t) => t.description === "Payoff");
  if (payoffIdx === -1) continue;
  console.log(`\n=== Account ${acct.accountNumber} (rate ${acct.loanTerms?.noteRatePercent}) ===`);
  const start = Math.max(0, payoffIdx - 4);
  for (let i = start; i <= payoffIdx; i++) {
    const t = acct.transactions[i];
    console.log(`  ${t.transactionDate} due=${t.paymentDueDate} desc="${t.description}" amt=${t.transactionAmount} int=${t.interestDistribution} prin=${t.principalDistribution} bal=${t.principalBalance}`);
  }
  shown++;
  if (shown >= 6) break;
}
