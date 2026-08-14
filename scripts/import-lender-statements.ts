import Decimal from "decimal.js";
import { parseLenderStatements, type ParsedLender } from "./parse-lender-statements";

/**
 * READ-ONLY reconciliation / dry-run for the Lender Statements import. Does
 * NOT write to the database. Matches each lender block to an existing
 * `parties` row (by display name, with the same ETC-Custodian-style
 * disambiguation the original TMO loan import used) and each ACCOUNT
 * ACTIVITY row's Loan Account to an existing `contracts` row (via
 * `TMO-<loanAccount>` — confirmed against real data: contract_number is
 * literally "TMO-" + the loan account's own digit string, preserving
 * whatever padding TMO used, e.g. "TMO-00382" for borrower Carl Schwartz and
 * "TMO-000001" for the one 6-digit account).
 */

function moneyToCents(raw: string | null): number | null {
  if (!raw) return null;
  const negative = raw.trim().startsWith("(") && raw.trim().endsWith(")");
  const digits = raw.replace(/[^0-9.]/g, "");
  if (digits === "") return null;
  const cents = new Decimal(digits).mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  return negative ? -cents : cents;
}

async function run() {
  const { config } = await import("dotenv");
  config({ path: ".env.local" });
  const { db } = await import("../src/db/client");
  const { sql } = await import("drizzle-orm");

  const filePath = process.argv[2] ?? "G:/Shared drives/SGMS/New LC Servicing Program/Lender Statements.csv";
  const lenders: ParsedLender[] = parseLenderStatements(filePath);

  console.log(`Parsed ${lenders.length} lender blocks.`);

  // --- Party matching -------------------------------------------------
  const partyRows = await db.execute(sql`SELECT id, display_name FROM parties`);
  const byExactName = new Map<string, string>();
  for (const row of partyRows as unknown as { id: string; display_name: string }[]) {
    byExactName.set(row.display_name, row.id);
  }

  let partiesMatched = 0;
  const unmatchedLenders: string[] = [];
  for (const l of lenders) {
    if (!l.displayName) continue;
    if (byExactName.has(l.displayName)) {
      partiesMatched++;
      continue;
    }
    // ETC-Custodian-style disambiguation used by the original TMO import.
    const disambiguated = `${l.displayName} (${l.lenderAccountCode})`;
    if (byExactName.has(disambiguated)) {
      partiesMatched++;
      continue;
    }
    unmatchedLenders.push(`${l.lenderAccountCode} / ${l.displayName}`);
  }
  console.log(`Lender parties matched: ${partiesMatched} / ${lenders.length}`);
  console.log("Unmatched lenders:", JSON.stringify(unmatchedLenders, null, 2));

  // --- Loan account -> contract matching -------------------------------
  const contractRows = await db.execute(sql`SELECT contract_number FROM contracts`);
  const contractNumbers = new Set((contractRows as unknown as { contract_number: string }[]).map((r) => r.contract_number));

  let totalTx = 0;
  let matchedTx = 0;
  let unmatchedTx = 0;
  let noLoanAccountTx = 0;
  const unmatchedLoanAccounts = new Map<string, number>();
  let totalAmountCents = 0;

  for (const l of lenders) {
    for (const t of l.transactions) {
      totalTx++;
      const amt = moneyToCents(t.transactionAmount) ?? 0;
      totalAmountCents += amt;

      if (!t.loanAccount) {
        noLoanAccountTx++;
        continue;
      }
      const candidate = `TMO-${t.loanAccount}`;
      if (contractNumbers.has(candidate)) {
        matchedTx++;
      } else {
        unmatchedTx++;
        unmatchedLoanAccounts.set(t.loanAccount, (unmatchedLoanAccounts.get(t.loanAccount) ?? 0) + 1);
      }
    }
  }

  console.log(`\nTotal ACCOUNT ACTIVITY rows: ${totalTx}`);
  console.log(`  Matched to an existing contract: ${matchedTx}`);
  console.log(`  No loan account on the row: ${noLoanAccountTx}`);
  console.log(`  Loan account present but no matching contract: ${unmatchedTx}`);
  console.log(`Distinct unmatched loan accounts (count of rows each):`, JSON.stringify(Object.fromEntries(unmatchedLoanAccounts), null, 2));
  console.log(`\nTotal transaction amount across all rows: $${(totalAmountCents / 100).toFixed(2)}`);

  // Column-sum sanity check (should be zero mismatches, per parser doc comment)
  let sumMismatches = 0;
  for (const l of lenders) {
    for (const t of l.transactions) {
      const amt = moneyToCents(t.transactionAmount) ?? 0;
      const sum =
        (moneyToCents(t.servicingFee) ?? 0) +
        (moneyToCents(t.interestDistribution) ?? 0) +
        (moneyToCents(t.principalDistribution) ?? 0) +
        (moneyToCents(t.charges) ?? 0) +
        (moneyToCents(t.other) ?? 0) +
        (moneyToCents(t.trust) ?? 0);
      if (amt !== sum) sumMismatches++;
    }
  }
  console.log(`\nColumn-sum mismatches (amount vs sum of 6 breakdown columns): ${sumMismatches} / ${totalTx}`);

  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
