import { parseFile } from "./parse-tmo-export";

const accounts = parseFile(process.argv[2]);
const matches = accounts.filter((a) => a.trustActivity.some((t) => t.toWhomPaidOrFromWhomReceived?.includes("RoboMax")));
console.log(`Accounts with RoboMax in trust ledger: ${matches.map((a) => a.accountNumber).join(", ")}`);
