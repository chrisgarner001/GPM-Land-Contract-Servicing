import { config } from "dotenv";
config({ path: ".env.local" });

/**
 * One-time AssessorSearch backfill, scoped to properties tied to an ACTIVE
 * contract — a paid-off/defaulted/cancelled/foreclosed contract's property
 * has no ongoing servicing need for assessor/tax data. Skips any property
 * that already has a snapshot on file, so this is safe to re-run (e.g. to
 * pick up newly-active contracts) without re-charging for ones already
 * backfilled — use the property page's own "Refresh" button for that.
 *
 * Dry run (default) never calls the billed API — it only reports how many
 * properties would be looked up. Pass --apply to actually spend credits
 * and write the results.
 *
 * Usage: npx tsx scripts/backfill-assessor-data.ts [--apply]
 */

const DELAY_BETWEEN_CALLS_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const apply = process.argv.includes("--apply");

  const { db } = await import("../src/db/client");
  const { eq, inArray } = await import("drizzle-orm");
  const { properties } = await import("../src/db/schema/parties");
  const { contracts } = await import("../src/db/schema/contracts");
  const { propertyAssessorSnapshots } = await import("../src/db/schema/assessorSearch");
  const { lookupPropertyByAddress } = await import("../src/lib/assessorSearch");

  const activeContractProperties = await db
    .select({ propertyId: contracts.propertyId })
    .from(contracts)
    .where(eq(contracts.status, "ACTIVE"));
  const activePropertyIds = [...new Set(activeContractProperties.map((c) => c.propertyId).filter((id): id is string => !!id))];

  const activeProperties = await db
    .select({ id: properties.id, streetAddress: properties.streetAddress, city: properties.city, state: properties.state, zip: properties.zip })
    .from(properties)
    .where(inArray(properties.id, activePropertyIds));

  const existingSnapshotRows = await db
    .select({ propertyId: propertyAssessorSnapshots.propertyId })
    .from(propertyAssessorSnapshots)
    .where(inArray(propertyAssessorSnapshots.propertyId, activePropertyIds));
  const alreadyFetched = new Set(existingSnapshotRows.map((r) => r.propertyId));

  const toFetch = activeProperties.filter((p) => !alreadyFetched.has(p.id));

  console.log(`Active-contract properties: ${activeProperties.length}`);
  console.log(`Already have assessor data on file: ${alreadyFetched.size}`);
  console.log(`Would look up: ${toFetch.length} (${toFetch.length} credits if all match; unmatched addresses are free)`);

  if (!apply) {
    console.log("\nDry run only — no API calls made. Pass --apply to actually look these up.");
    toFetch.forEach((p) => console.log(` - ${p.streetAddress}, ${p.city}, ${p.state} ${p.zip}`));
    return;
  }

  let matched = 0;
  let unmatched = 0;
  let failed = 0;

  for (const property of toFetch) {
    const address = `${property.streetAddress}, ${property.city}, ${property.state} ${property.zip}`;
    try {
      const record = await lookupPropertyByAddress(address);
      if (!record) {
        unmatched++;
        console.log(`No match: ${address}`);
      } else {
        matched++;
        await db.insert(propertyAssessorSnapshots).values({
          propertyId: property.id,
          assessorPropertyId: record.assessorPropertyId,
          apn: record.apn,
          county: record.county,
          ownerFullName: record.ownerFullName,
          assessedValueCents: record.assessedValueCents,
          totalMarketValueCents: record.totalMarketValueCents,
          estimatedMarketValueCents: record.estimatedMarketValueCents,
          annualTaxAmountCents: record.annualTaxAmountCents,
          taxYear: record.taxYear,
          isTaxExemption: record.isTaxExemption,
          exemptionType: record.exemptionType,
          delinquentYear: record.delinquentYear,
          lastSaleDate: record.lastSaleDate,
          lastSaleAmountCents: record.lastSaleAmountCents,
          isListed: record.isListed,
          isListedDate: record.isListedDate,
          isPreForeclosure: record.isPreForeclosure,
          yearBuilt: record.yearBuilt,
          beds: record.beds,
          baths: record.baths !== null ? String(record.baths) : null,
          sqft: record.sqft,
          lotSizeSqft: record.lotSizeSqft,
          legalDescription: record.legalDescription,
          combinedEstimatedLoanBalanceCents: record.combinedEstimatedLoanBalanceCents,
          estimatedEquityCents: record.estimatedEquityCents,
          rawResponse: record.raw,
        });
        if (record.county) {
          await db.update(properties).set({ county: record.county }).where(eq(properties.id, property.id));
        }
        console.log(`Matched: ${address}`);
      }
    } catch (e) {
      failed++;
      console.error(`Failed: ${address} — ${e instanceof Error ? e.message : e}`);
    }
    await sleep(DELAY_BETWEEN_CALLS_MS);
  }

  console.log(`\nDone. Matched: ${matched}, unmatched (free): ${unmatched}, failed: ${failed}.`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
