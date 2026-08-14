/**
 * One-time (but idempotent/re-runnable) backfill for checks.bank_account_id.
 *
 * The TMO "Check Register with Detail" import never carried a bank-account
 * field, and no other table in the schema records which account a historical
 * check cleared. The only reconstructable signal is lender-vs-non-lender
 * (isLenderPayeeSql): lender distributions are the one type of check this
 * app creates programmatically (src/server/lenderPaymentRuns.ts), and they
 * always draw from Owner Trust. So this backfill sets bank_account_id =
 * Owner Trust for every check matching isLenderPayeeSql, and leaves
 * everything else null ("Unclassified") — there's no data to guess Escrow
 * vs Operating for the rest.
 *
 * Usage: npx tsx scripts/backfill-check-bank-accounts.ts [--apply]
 * Dry-run by default; pass --apply to actually update rows.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const apply = process.argv.includes("--apply");

  const { db } = await import("../src/db/client");
  const { checks } = await import("../src/db/schema/checks");
  const { bankAccounts } = await import("../src/db/schema/setup");
  const { isLenderPayeeSql } = await import("../src/server/checkClassification");
  const { and, eq, isNull, sql } = await import("drizzle-orm");

  const [ownerTrust] = await db.select().from(bankAccounts).where(eq(bankAccounts.label, "Owner Trust"));
  if (!ownerTrust) throw new Error('No bank account with label "Owner Trust" found.');

  const toUpdate = await db
    .select({ id: checks.id })
    .from(checks)
    .where(and(isLenderPayeeSql, isNull(checks.bankAccountId)));

  console.log(`Found ${toUpdate.length} lender-payee checks with no bank account set.`);
  if (!apply) {
    console.log("Dry run — pass --apply to update.");
    process.exit(0);
  }

  await db
    .update(checks)
    .set({ bankAccountId: ownerTrust.id })
    .where(and(isLenderPayeeSql, isNull(checks.bankAccountId)));

  console.log(`Updated ${toUpdate.length} checks to Owner Trust (${ownerTrust.id}).`);
  process.exit(0);
}

main();
