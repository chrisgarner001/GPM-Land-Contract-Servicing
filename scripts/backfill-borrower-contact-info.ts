import { parseBorrowerListing, type ParsedBorrower } from "./parse-borrower-listing";

/**
 * Backfills parties.phone_home/phone_work/phone_mobile/phone_fax/middle_initial
 * for BUYER parties from TMO's "Borrower Name & Address Listing" export.
 *
 * Scoped narrowly on purpose: mailing_address_line1 is already populated for
 * 409/410 buyer parties and the legacy `phone` field for 403/410 (both from
 * the original per-contract TMO loan import, a more authoritative source for
 * those fields than this report) — confirmed against real data before
 * writing this script. This report's only real value-add is the four phone
 * TYPES (0/410 populated before this) and middle_initial.
 *
 * DRY RUN BY DEFAULT. Pass --apply to actually write. Never overwrites a
 * field that's already non-null.
 *
 * Usage:
 *   npx tsx scripts/backfill-borrower-contact-info.ts                 # dry run
 *   npx tsx scripts/backfill-borrower-contact-info.ts --apply          # writes
 */

function loanAccountKey(raw: string): number {
  return parseInt(raw.replace(/\D/g, ""), 10);
}

interface UpdateCandidate {
  accountNumber: string;
  displayName: string;
  partyId: string;
  contractNumber: string;
  fields: Record<string, string>;
}

async function run() {
  const { config } = await import("dotenv");
  config({ path: ".env.local" });
  const { db } = await import("../src/db/client");
  const { sql } = await import("drizzle-orm");

  const apply = process.argv.includes("--apply");
  const filePath = process.argv.find((a) => a.endsWith(".csv")) ?? "G:/Shared drives/SGMS/New LC Servicing Program/Borrower Name Address Listing.csv";

  const borrowers: ParsedBorrower[] = parseBorrowerListing(filePath);
  console.log(`Parsed ${borrowers.length} borrowers from ${filePath}.`);

  const contractRows = (await db.execute(sql`SELECT id, contract_number FROM contracts`)) as unknown as {
    id: string;
    contract_number: string;
  }[];
  const contractByLoanKey = new Map<number, { id: string; contractNumber: string }>();
  for (const c of contractRows) {
    contractByLoanKey.set(loanAccountKey(c.contract_number), { id: c.id, contractNumber: c.contract_number });
  }

  const buyerRows = (await db.execute(
    sql`SELECT cp.contract_id, cp.party_id, p.phone_home, p.phone_work, p.phone_mobile, p.phone_fax, p.middle_initial
        FROM contract_parties cp JOIN parties p ON p.id = cp.party_id
        WHERE cp.role = 'BUYER'`
  )) as unknown as {
    contract_id: string;
    party_id: string;
    phone_home: string | null;
    phone_work: string | null;
    phone_mobile: string | null;
    phone_fax: string | null;
    middle_initial: string | null;
  }[];
  const buyersByContract = new Map<string, typeof buyerRows>();
  for (const r of buyerRows) {
    const list = buyersByContract.get(r.contract_id) ?? [];
    list.push(r);
    buyersByContract.set(r.contract_id, list);
  }

  const candidates: UpdateCandidate[] = [];
  const unmatchedAccounts: string[] = [];
  const ambiguousBuyers: { accountNumber: string; contractId: string; buyerCount: number }[] = [];

  for (const b of borrowers) {
    if (!b.accountNumber) continue;
    const contract = contractByLoanKey.get(loanAccountKey(b.accountNumber));
    if (!contract) {
      unmatchedAccounts.push(b.accountNumber);
      continue;
    }
    const buyers = buyersByContract.get(contract.id) ?? [];
    if (buyers.length !== 1) {
      ambiguousBuyers.push({ accountNumber: b.accountNumber, contractId: contract.id, buyerCount: buyers.length });
      continue;
    }
    const buyer = buyers[0];

    const fields: Record<string, string> = {};
    if (buyer.phone_home === null && b.homePhone) fields.phone_home = b.homePhone;
    if (buyer.phone_work === null && b.workPhone) fields.phone_work = b.workPhone;
    if (buyer.phone_mobile === null && b.cellPhone) fields.phone_mobile = b.cellPhone;
    if (buyer.phone_fax === null && b.faxPhone) fields.phone_fax = b.faxPhone;
    if (buyer.middle_initial === null && b.middleInitial) fields.middle_initial = b.middleInitial;

    if (Object.keys(fields).length > 0) {
      candidates.push({
        accountNumber: b.accountNumber,
        displayName: b.displayName,
        partyId: buyer.party_id,
        contractNumber: contract.contractNumber,
        fields,
      });
    }
  }

  console.log(`\nLoan accounts with no matching contract: ${unmatchedAccounts.length}`);
  if (unmatchedAccounts.length > 0) console.log(JSON.stringify(unmatchedAccounts, null, 2));
  console.log(`\nContracts with 0 or 2+ BUYER rows (ambiguous, skipped): ${ambiguousBuyers.length}`);
  if (ambiguousBuyers.length > 0) console.log(JSON.stringify(ambiguousBuyers, null, 2));

  console.log(`\nRows that will be updated (at least one new field): ${candidates.length}`);
  console.log("Sample of 5:", JSON.stringify(candidates.slice(0, 5), null, 2));

  if (!apply) {
    console.log(`\nDRY RUN — no changes written. Re-run with --apply to write ${candidates.length} updates.`);
    process.exit(0);
  }

  console.log(`\nApplying ${candidates.length} updates...`);
  let updated = 0;
  for (const c of candidates) {
    await db.execute(sql`
      UPDATE parties
      SET
        phone_home = COALESCE(phone_home, ${c.fields.phone_home ?? null}),
        phone_work = COALESCE(phone_work, ${c.fields.phone_work ?? null}),
        phone_mobile = COALESCE(phone_mobile, ${c.fields.phone_mobile ?? null}),
        phone_fax = COALESCE(phone_fax, ${c.fields.phone_fax ?? null}),
        middle_initial = COALESCE(middle_initial, ${c.fields.middle_initial ?? null})
      WHERE id = ${c.partyId}
    `);
    updated++;
  }
  console.log(`Done. Updated ${updated} parties rows.`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
