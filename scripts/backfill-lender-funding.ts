import Decimal from "decimal.js";
import { parseLenderFunding, type ParsedLenderFunding } from "./parse-lender-funding";

/**
 * Backfills contract_parties.funded_amount_cents / interest_rate_annual /
 * funding_date from the "Lender Statement of Account" export's INVESTMENT
 * PORTFOLIO (ownership %, rate) and FUNDING ACTIVITY (date, amount funded)
 * sections — see parse-lender-funding.ts's doc comment for exact column
 * mapping. These three fields were confirmed NULL on all 710 existing
 * INVESTOR_PAYEE rows (never captured during the original TMO import).
 *
 * DRY RUN BY DEFAULT. Pass --apply to actually write. Never overwrites a
 * field that's already non-null (defensive — protects any manual edit
 * already made via the new Edit Funding Details modal).
 *
 * Usage:
 *   npx tsx scripts/backfill-lender-funding.ts                  # dry run
 *   npx tsx scripts/backfill-lender-funding.ts --apply           # writes
 */

function moneyToCents(raw: string | null): number | null {
  if (!raw) return null;
  const negative = raw.trim().startsWith("(") && raw.trim().endsWith(")");
  const digits = raw.replace(/[^0-9.]/g, "");
  if (digits === "") return null;
  const cents = new Decimal(digits).mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  return negative ? -cents : cents;
}

function percentToDecimalString(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9.]/g, "");
  return digits === "" ? null : new Decimal(digits).toFixed(4);
}

function mmddyyyyToIso(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

// contracts.contract_number is "TMO-" + the loan account's own digit string
// with whatever padding TMO used (confirmed by import-lender-statements.ts)
// — but a couple of contracts use 6-digit padding vs the export's 5-digit
// loan account, so match by numeric value, not string equality.
function loanAccountKey(raw: string): number {
  return parseInt(raw.replace(/\D/g, ""), 10);
}

interface FundingUpdateCandidate {
  lenderAccountCode: string;
  lenderDisplayName: string;
  loanAccount: string;
  partyId: string;
  contractId: string;
  contractNumber: string;
  contractPartyId: string;
  currentFundedAmountCents: number | null;
  currentInterestRateAnnual: string | null;
  currentFundingDate: string | null;
  newFundedAmountCents: number | null;
  newInterestRateAnnual: string | null;
  newFundingDate: string | null;
}

async function run() {
  const { config } = await import("dotenv");
  config({ path: ".env.local" });
  const { db } = await import("../src/db/client");
  const { sql } = await import("drizzle-orm");

  const apply = process.argv.includes("--apply");
  const filePath = process.argv.find((a) => a.endsWith(".csv")) ?? "G:/Shared drives/SGMS/New LC Servicing Program/Lender Statement of Account.csv";

  const lenders: ParsedLenderFunding[] = parseLenderFunding(filePath);
  console.log(`Parsed ${lenders.length} lender blocks from ${filePath}.`);

  const partyRows = (await db.execute(sql`SELECT id, display_name FROM parties`)) as unknown as {
    id: string;
    display_name: string;
  }[];
  const partyByName = new Map(partyRows.map((r) => [r.display_name, r.id]));

  const contractRows = (await db.execute(sql`SELECT id, contract_number FROM contracts`)) as unknown as {
    id: string;
    contract_number: string;
  }[];
  const contractByLoanKey = new Map<number, { id: string; contractNumber: string }>();
  for (const c of contractRows) {
    contractByLoanKey.set(loanAccountKey(c.contract_number), { id: c.id, contractNumber: c.contract_number });
  }

  const cpRows = (await db.execute(
    sql`SELECT id, contract_id, party_id, funded_amount_cents, interest_rate_annual, funding_date
        FROM contract_parties WHERE role = 'INVESTOR_PAYEE'`
  )) as unknown as {
    id: string;
    contract_id: string;
    party_id: string;
    funded_amount_cents: number | null;
    interest_rate_annual: string | null;
    funding_date: string | null;
  }[];
  const cpByContractParty = new Map<string, typeof cpRows>();
  for (const r of cpRows) {
    const key = `${r.contract_id}::${r.party_id}`;
    const list = cpByContractParty.get(key) ?? [];
    list.push(r);
    cpByContractParty.set(key, list);
  }

  const candidates: FundingUpdateCandidate[] = [];
  const unmatchedLenders: string[] = [];
  const unmatchedLoanAccounts: { lender: string; loanAccount: string }[] = [];
  const ambiguousContractParty: { lender: string; loanAccount: string; contractId: string; partyId: string; rowCount: number }[] = [];
  const multipleFundingRowsPerLoan: { lender: string; loanAccount: string; count: number; netAmountCents: number }[] = [];
  const alreadyPopulated: { lender: string; loanAccount: string; field: string }[] = [];

  for (const lender of lenders) {
    if (!lender.displayName) continue;
    const disambiguated = `${lender.displayName} (${lender.lenderAccountCode})`;
    const partyId = partyByName.get(lender.displayName) ?? partyByName.get(disambiguated);
    if (!partyId) {
      unmatchedLenders.push(`${lender.lenderAccountCode} / ${lender.displayName}`);
      continue;
    }

    const portfolioByLoan = new Map(lender.portfolio.map((p) => [p.loanAccount, p]));
    const fundingByLoan = new Map<string, typeof lender.funding>();
    for (const f of lender.funding) {
      if (!f.loanAccount) continue;
      const list = fundingByLoan.get(f.loanAccount) ?? [];
      list.push(f);
      fundingByLoan.set(f.loanAccount, list);
    }

    const allLoanAccounts = new Set([...portfolioByLoan.keys(), ...fundingByLoan.keys()]);
    for (const loanAccount of allLoanAccounts) {
      const contract = contractByLoanKey.get(loanAccountKey(loanAccount));
      if (!contract) {
        unmatchedLoanAccounts.push({ lender: lender.lenderAccountCode, loanAccount });
        continue;
      }

      const cpMatches = cpByContractParty.get(`${contract.id}::${partyId}`) ?? [];
      if (cpMatches.length !== 1) {
        ambiguousContractParty.push({
          lender: lender.lenderAccountCode,
          loanAccount,
          contractId: contract.id,
          partyId,
          rowCount: cpMatches.length,
        });
        continue;
      }
      const cp = cpMatches[0];

      // Multiple FUNDING ACTIVITY rows for one (lender, loan) pair are real
      // and common (361 cases in this export) — Closing/CORRECTION reversal
      // pairs, or transfers splitting a position with a related lender
      // entity. Net-summing works for some (e.g. two cancelling
      // Closing/CORRECTION pairs followed by a clean final Closing) but not
      // reliably for others (a transfer-out sequence can net to a small
      // real remainder that may belong to an already-closed-out position,
      // not the current one) — confirmed by manually checking two real
      // examples that needed opposite handling. Rather than guess, only
      // funded_amount_cents/funding_date get skipped and reported here for
      // human review; interest_rate_annual (from the separate, unambiguous
      // INVESTMENT PORTFOLIO section) is unaffected and still backfilled.
      const fundingRows = fundingByLoan.get(loanAccount) ?? [];
      const portfolioRow = portfolioByLoan.get(loanAccount);
      const newInterestRateAnnual = portfolioRow ? percentToDecimalString(portfolioRow.interestRate) : null;

      let newFundedAmountCents: number | null = null;
      let newFundingDate: string | null = null;
      if (fundingRows.length > 1) {
        const netCents = fundingRows.reduce((s, f) => s + (moneyToCents(f.amountFunded) ?? 0), 0);
        multipleFundingRowsPerLoan.push({
          lender: lender.lenderAccountCode,
          loanAccount,
          count: fundingRows.length,
          netAmountCents: netCents,
        });
      } else if (fundingRows.length === 1) {
        newFundedAmountCents = moneyToCents(fundingRows[0].amountFunded);
        newFundingDate = mmddyyyyToIso(fundingRows[0].transactionDate);
      }

      if (cp.funded_amount_cents !== null && newFundedAmountCents !== null) {
        alreadyPopulated.push({ lender: lender.lenderAccountCode, loanAccount, field: "funded_amount_cents" });
      }
      if (cp.interest_rate_annual !== null && newInterestRateAnnual !== null) {
        alreadyPopulated.push({ lender: lender.lenderAccountCode, loanAccount, field: "interest_rate_annual" });
      }
      if (cp.funding_date !== null && newFundingDate !== null) {
        alreadyPopulated.push({ lender: lender.lenderAccountCode, loanAccount, field: "funding_date" });
      }

      candidates.push({
        lenderAccountCode: lender.lenderAccountCode,
        lenderDisplayName: lender.displayName,
        loanAccount,
        partyId,
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        contractPartyId: cp.id,
        currentFundedAmountCents: cp.funded_amount_cents,
        currentInterestRateAnnual: cp.interest_rate_annual,
        currentFundingDate: cp.funding_date,
        newFundedAmountCents: cp.funded_amount_cents === null ? newFundedAmountCents : null,
        newInterestRateAnnual: cp.interest_rate_annual === null ? newInterestRateAnnual : null,
        newFundingDate: cp.funding_date === null ? newFundingDate : null,
      });
    }
  }

  const actuallyUpdating = candidates.filter(
    (c) => c.newFundedAmountCents !== null || c.newInterestRateAnnual !== null || c.newFundingDate !== null
  );

  console.log(`\nLenders matched to a party: ${lenders.length - unmatchedLenders.length} / ${lenders.length}`);
  console.log(`Unmatched lenders:`, JSON.stringify(unmatchedLenders, null, 2));
  console.log(`\nLoan accounts with no matching contract: ${unmatchedLoanAccounts.length}`);
  if (unmatchedLoanAccounts.length > 0) console.log(JSON.stringify(unmatchedLoanAccounts, null, 2));
  console.log(`\nAmbiguous contract_parties matches (0 or 2+ rows for contract+lender): ${ambiguousContractParty.length}`);
  if (ambiguousContractParty.length > 0) console.log(JSON.stringify(ambiguousContractParty, null, 2));
  console.log(`\nLoan accounts with multiple FUNDING ACTIVITY rows (using earliest, flagged for review): ${multipleFundingRowsPerLoan.length}`);
  if (multipleFundingRowsPerLoan.length > 0) console.log(JSON.stringify(multipleFundingRowsPerLoan, null, 2));
  console.log(`\nRows where the DB already has a value (left untouched, not overwritten): ${alreadyPopulated.length}`);
  if (alreadyPopulated.length > 0) console.log(JSON.stringify(alreadyPopulated, null, 2));

  console.log(`\nTotal (lender, loan account) pairs found: ${candidates.length}`);
  console.log(`Rows that will actually be updated (at least one field newly populated): ${actuallyUpdating.length}`);
  console.log(`Sample of 5 updates:`, JSON.stringify(actuallyUpdating.slice(0, 5), null, 2));

  if (!apply) {
    console.log(`\nDRY RUN — no changes written. Re-run with --apply to write ${actuallyUpdating.length} updates.`);
    process.exit(0);
  }

  console.log(`\nApplying ${actuallyUpdating.length} updates...`);
  let updated = 0;
  for (const c of actuallyUpdating) {
    await db.execute(sql`
      UPDATE contract_parties
      SET
        funded_amount_cents = COALESCE(funded_amount_cents, ${c.newFundedAmountCents}),
        interest_rate_annual = COALESCE(interest_rate_annual, ${c.newInterestRateAnnual}),
        funding_date = COALESCE(funding_date, ${c.newFundingDate})
      WHERE id = ${c.contractPartyId}
    `);
    updated++;
  }
  console.log(`Done. Updated ${updated} contract_parties rows.`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
