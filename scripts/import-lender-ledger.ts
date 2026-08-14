import Decimal from "decimal.js";
import { parseLenderStatements, type ParsedLender } from "./parse-lender-statements";

/**
 * Replaces the synthetic `lender_ledger_entries` rows created by the
 * original TMO import (description "Computed from imported payment (...)",
 * a payment-P&I × ownership% − broker-fee estimate) with TMO's own real
 * ACCOUNT ACTIVITY history from Lender Statements.csv. Confirmed before
 * running this that every existing row in the table matches that synthetic
 * description — a clean full replace, not a partial merge.
 *
 * Sign convention (matches the schema's documented intent in lending.ts):
 * rows with a Loan Account are a borrower-payment credit into the lender's
 * ledger (amountReceivedCents, sign preserved so parenthesized reversals
 * stay negative); the single row with no Loan Account is a "Lender Check"
 * sweep-out (amountPaidOutCents, sourceContractId null).
 *
 * Two lenders (Aaron Cox, GPM) have real transaction history but no
 * existing `parties` row — the original Loan Master Report import apparently
 * never captured their involvement. New party rows are created for them so
 * their ledger history isn't silently dropped; this does NOT link them as a
 * contract owner/INVESTOR_PAYEE, just gives their ledger rows somewhere to
 * point.
 *
 * Loan accounts 00383/00384 (46 rows) reference contracts that were never
 * migrated in the original 410-contract import — those rows are skipped and
 * reported, not silently dropped.
 */

function moneyToCents(raw: string | null): number | null {
  if (!raw) return null;
  const negative = raw.trim().startsWith("(") && raw.trim().endsWith(")");
  const digits = raw.replace(/[^0-9.]/g, "");
  if (digits === "") return null;
  const cents = new Decimal(digits).mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  return negative ? -cents : cents;
}

function toIsoDate(mmddyyyy: string): string {
  const [m, d, y] = mmddyyyy.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function describeBreakdown(t: {
  servicingFee: string | null;
  interestDistribution: string | null;
  principalDistribution: string | null;
  charges: string | null;
  other: string | null;
}): string {
  const parts: string[] = [];
  if (moneyToCents(t.servicingFee)) parts.push(`Serv Fee ${t.servicingFee}`);
  if (moneyToCents(t.interestDistribution)) parts.push(`Interest ${t.interestDistribution}`);
  if (moneyToCents(t.principalDistribution)) parts.push(`Principal ${t.principalDistribution}`);
  if (moneyToCents(t.charges)) parts.push(`Charges ${t.charges}`);
  if (moneyToCents(t.other)) parts.push(`Other ${t.other}`);
  return parts.length > 0 ? parts.join(" / ") : "Lender distribution";
}

async function insertInChunks<T extends Record<string, unknown>>(
  tx: { insert: (table: unknown) => { values: (rows: T[]) => Promise<unknown> } },
  table: unknown,
  rows: T[],
  chunkSize = 500
) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    await tx.insert(table).values(rows.slice(i, i + chunkSize));
  }
}

async function run() {
  const write = process.argv.includes("--write");
  const filePath = process.argv.find((a) => a.endsWith(".csv")) ?? "G:/Shared drives/SGMS/New LC Servicing Program/Lender Statements.csv";
  // Restricts processing to specific lender account codes — used for a
  // targeted top-up insert without touching already-correct rows, rather
  // than re-running (and duplicating) the full replace.
  const onlyCodesArg = process.argv.find((a) => a.startsWith("--only-codes="));
  const onlyCodes = onlyCodesArg ? new Set(onlyCodesArg.slice("--only-codes=".length).split(",")) : null;

  const { db } = await import("../src/db/client");
  const { sql } = await import("drizzle-orm");
  const { parties } = await import("../src/db/schema/parties");
  const { lenderLedgerEntries } = await import("../src/db/schema/lending");

  let lenders: ParsedLender[] = parseLenderStatements(filePath);
  if (onlyCodes) lenders = lenders.filter((l) => onlyCodes.has(l.lenderAccountCode));

  // --- Ensure Aaron Cox and GPM have party rows -------------------------
  const NEW_LENDER_PARTIES: Record<string, "INDIVIDUAL" | "BUSINESS"> = {
    "Aaron Cox": "INDIVIDUAL",
    GPM: "BUSINESS",
  };
  if (write) {
    for (const [displayName, partyType] of Object.entries(NEW_LENDER_PARTIES)) {
      const [existing] = await db.execute(sql`SELECT id FROM parties WHERE display_name = ${displayName}`);
      if (!existing) {
        await db.insert(parties).values({ partyType, displayName });
        console.log(`Created party: ${displayName} (${partyType})`);
      }
    }
  }

  // --- Party matching ----------------------------------------------------
  const partyRows = await db.execute(sql`SELECT id, display_name FROM parties`);
  const partyIdByName = new Map<string, string>();
  for (const row of partyRows as unknown as { id: string; display_name: string }[]) {
    partyIdByName.set(row.display_name, row.id);
  }

  // --- Contract matching ---------------------------------------------------
  const contractRows = await db.execute(sql`SELECT id, contract_number FROM contracts`);
  const contractIdByNumber = new Map<string, string>();
  for (const row of contractRows as unknown as { id: string; contract_number: string }[]) {
    contractIdByNumber.set(row.contract_number, row.id);
  }

  type Row = {
    lenderPartyId: string;
    sourceContractId: string | null;
    transactionDate: string;
    reference: string | null;
    description: string;
    amountPaidOutCents: number | null;
    amountReceivedCents: number | null;
    balanceCents: null;
  };

  const rows: Row[] = [];
  let skippedNoParty = 0;
  let skippedNoContract = 0;
  const skippedLoanAccounts = new Map<string, number>();

  for (const lender of lenders) {
    if (!lender.displayName) continue;
    // Some lenders share a display name (e.g. multiple "ETC Custodian FBO"
    // self-directed IRA accounts) — the original TMO import disambiguated
    // these in `parties.display_name` as "Name (ACCOUNTCODE)".
    const lenderPartyId =
      partyIdByName.get(lender.displayName) ?? partyIdByName.get(`${lender.displayName} (${lender.lenderAccountCode})`);
    if (!lenderPartyId) {
      skippedNoParty += lender.transactions.length;
      continue;
    }

    for (const t of lender.transactions) {
      if (!t.transactionDate) continue;
      const amt = moneyToCents(t.transactionAmount) ?? 0;

      let sourceContractId: string | null = null;
      if (t.loanAccount) {
        const candidate = `TMO-${t.loanAccount}`;
        sourceContractId = contractIdByNumber.get(candidate) ?? null;
        if (!sourceContractId) {
          skippedNoContract++;
          skippedLoanAccounts.set(t.loanAccount, (skippedLoanAccounts.get(t.loanAccount) ?? 0) + 1);
          continue;
        }
      }

      rows.push({
        lenderPartyId,
        sourceContractId,
        transactionDate: toIsoDate(t.transactionDate),
        reference: t.reference,
        description: describeBreakdown(t),
        amountPaidOutCents: t.loanAccount ? null : Math.abs(amt),
        amountReceivedCents: t.loanAccount ? amt : null,
        balanceCents: null,
      });
    }
  }

  console.log(`Lenders parsed: ${lenders.length}`);
  console.log(`Rows built for insert: ${rows.length}`);
  console.log(`Skipped (lender has no party row): ${skippedNoParty}`);
  console.log(`Skipped (loan account has no matching contract): ${skippedNoContract}`, Object.fromEntries(skippedLoanAccounts));

  if (!write) {
    console.log("\nDry run — pass --write to apply. Sample rows:");
    console.log(rows.slice(0, 3));
    process.exit(0);
  }

  await db.transaction(async (tx) => {
    if (!onlyCodes) {
      const deleted = await tx.delete(lenderLedgerEntries).where(sql`description LIKE 'Computed from imported payment%'`);
      console.log("Deleted synthetic rows:", deleted);
    }
    await insertInChunks(tx as never, lenderLedgerEntries, rows);
  });

  const [{ c: finalCount }] = (await db.execute(sql`SELECT count(*) AS c FROM lender_ledger_entries`)) as unknown as { c: string }[];
  console.log(`Final lender_ledger_entries row count: ${finalCount} (expected ${rows.length})`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
