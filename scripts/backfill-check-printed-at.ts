/**
 * checks.printed_at tracks what's still pending in the new Print Checks
 * queues (Lender and Vendor). Every check in the table as of this feature's
 * launch was already physically issued long ago (the TMO historical
 * import — confirmed all 4,989 rows share a created_at clustered on the
 * single 2026-07-24 import run, and no real distribution has gone through
 * Lender Payment Runs' check flow yet). Those must never show up as
 * "pending print," so this one-time backfill marks all of them printed
 * (using each check's own checkDate as printedAt, since that's when it
 * really was issued). Only checks created after this backfill runs — via
 * Lender Payment Runs or the new Vendor Print Checks flow — start with
 * printedAt null and correctly appear in the queues.
 *
 * Usage: npx tsx scripts/backfill-check-printed-at.ts [--apply]
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const apply = process.argv.includes("--apply");

  const { db } = await import("../src/db/client");
  const { checks } = await import("../src/db/schema/checks");
  const { isNull, sql } = await import("drizzle-orm");

  const toUpdate = await db.select({ id: checks.id }).from(checks).where(isNull(checks.printedAt));
  console.log(`Found ${toUpdate.length} checks with no printedAt set.`);
  if (!apply) {
    console.log("Dry run — pass --apply to update.");
    process.exit(0);
  }

  await db.execute(sql`UPDATE checks SET printed_at = check_date::timestamptz WHERE printed_at IS NULL`);
  console.log(`Updated ${toUpdate.length} checks.`);
  process.exit(0);
}

main();
