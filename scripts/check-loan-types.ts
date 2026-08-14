import { parseFile } from "./parse-tmo-export";

const accounts = parseFile(process.argv[2]);
const types: Record<string, number> = {};
const amortTypes: Record<string, number> = {};
for (const acct of accounts) {
  const t = acct.loanTerms?.loanType ?? "UNKNOWN";
  types[t] = (types[t] ?? 0) + 1;
  const a = acct.loanTerms?.amortizationType ?? "UNKNOWN";
  amortTypes[a] = (amortTypes[a] ?? 0) + 1;
}
console.log("Loan Type counts:", types);
console.log("Amortization Type counts:", amortTypes);
