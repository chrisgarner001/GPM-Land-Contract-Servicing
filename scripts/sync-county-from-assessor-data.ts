import { config } from "dotenv";
config({ path: ".env.local" });

/**
 * One-time catch-up for the 227 properties already backfilled by
 * scripts/backfill-assessor-data.ts before it started syncing county
 * automatically — reads each property's existing (already-paid-for)
 * snapshot and updates properties.county from it. Makes zero AssessorSearch
 * API calls. Safe to re-run: only ever active-contract properties have a
 * snapshot, and re-running just re-applies the same latest value.
 *
 * Usage: npx tsx scripts/sync-county-from-assessor-data.ts [--apply]
 */
async function run() {
  const apply = process.argv.includes("--apply");

  const { db } = await import("../src/db/client");
  const { eq, desc, inArray } = await import("drizzle-orm");
  const { properties } = await import("../src/db/schema/parties");
  const { propertyAssessorSnapshots } = await import("../src/db/schema/assessorSearch");
  const { normalizeCountyName } = await import("../src/lib/assessorSearch");

  const snapshotRows = await db
    .select({
      propertyId: propertyAssessorSnapshots.propertyId,
      county: propertyAssessorSnapshots.county,
      fetchedAt: propertyAssessorSnapshots.fetchedAt,
    })
    .from(propertyAssessorSnapshots)
    .orderBy(desc(propertyAssessorSnapshots.fetchedAt));

  const latestCountyByProperty = new Map<string, string>();
  for (const row of snapshotRows) {
    if (!latestCountyByProperty.has(row.propertyId) && row.county) {
      latestCountyByProperty.set(row.propertyId, row.county);
    }
  }

  const propertyIds = [...latestCountyByProperty.keys()];
  const currentProperties = await db
    .select({ id: properties.id, county: properties.county })
    .from(properties)
    .where(inArray(properties.id, propertyIds));

  const updates = currentProperties
    .map((p) => ({ id: p.id, current: p.county, next: normalizeCountyName(latestCountyByProperty.get(p.id) ?? null) }))
    .filter((u) => u.next && u.next !== u.current);

  console.log(`Properties with a snapshot on file: ${propertyIds.length}`);
  console.log(`Would update county on: ${updates.length}`);
  updates.forEach((u) => console.log(` - ${u.current ?? "(none)"} -> ${u.next}`));

  if (!apply) {
    console.log("\nDry run only — pass --apply to write these changes.");
    return;
  }

  for (const u of updates) {
    await db.update(properties).set({ county: u.next! }).where(eq(properties.id, u.id));
  }
  console.log(`\nUpdated ${updates.length} properties.`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
