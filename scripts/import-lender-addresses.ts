import { parseVendorLenderAddresses, type ParsedAddressRecord } from "./parse-vendor-lender-address";

/**
 * Enriches existing Lender `parties` rows (contact info was never imported
 * for them — unlike Borrowers — because TMO can only export a combined
 * Vendor+Lender name/address report, not a lender-only one) using the parsed
 * "LENDER NAME & ADDRESS LISTING" export. Matches records to existing lender
 * parties by exact display name; never creates new parties, never overwrites
 * a field that already has a value. Dry-run by default — pass --apply to
 * actually write.
 */

function pickPhone(r: ParsedAddressRecord): string | null {
  return r.homePhone ?? r.workPhone ?? r.cellPhone ?? r.faxPhone ?? null;
}

async function run() {
  const { config } = await import("dotenv");
  config({ path: ".env.local" });
  const { db } = await import("../src/db/client");
  const { eq, and, gt } = await import("drizzle-orm");
  const { parties } = await import("../src/db/schema/parties");
  const { contractParties } = await import("../src/db/schema/contracts");

  const apply = process.argv.includes("--apply");
  const filePath = process.argv[2]?.startsWith("--") || !process.argv[2]
    ? "import-data/vendor_lender_address.csv"
    : process.argv[2];

  const records = parseVendorLenderAddresses(filePath);
  console.log(`Parsed ${records.length} name/address records.`);

  const byDisplayName = new Map<string, ParsedAddressRecord>();
  const byAccountCode = new Map<string, ParsedAddressRecord>();
  for (const r of records) {
    byDisplayName.set(r.displayName.trim().toLowerCase(), r);
    if (r.accountCode) byAccountCode.set(r.accountCode.trim().toLowerCase(), r);
  }

  // A handful of parties share one underlying display name (e.g. multiple
  // "ETC Custodian FBO" sub-accounts) and were disambiguated at import time by
  // appending "(<account code>)" — fall back to matching on that code.
  const PARENTHETICAL_CODE_RE = /\(([A-Za-z0-9-]+)\)\s*$/;

  const lenders = await db
    .selectDistinct({
      id: parties.id,
      partyType: parties.partyType,
      displayName: parties.displayName,
      companyName: parties.companyName,
      firstName: parties.firstName,
      lastName: parties.lastName,
      phone: parties.phone,
      mailingAddressLine1: parties.mailingAddressLine1,
      mailingCity: parties.mailingCity,
      mailingState: parties.mailingState,
      mailingZip: parties.mailingZip,
    })
    .from(parties)
    .innerJoin(
      contractParties,
      and(eq(contractParties.partyId, parties.id), eq(contractParties.role, "INVESTOR_PAYEE"), gt(contractParties.ownershipPercent, "0"))
    );

  console.log(`Found ${lenders.length} lender parties.`);

  let matched = 0;
  let noChangeNeeded = 0;
  const unmatched: string[] = [];
  const updates: { id: string; displayName: string; changes: Record<string, string> }[] = [];

  for (const lender of lenders) {
    let record = byDisplayName.get(lender.displayName.trim().toLowerCase());
    if (!record) {
      const codeMatch = PARENTHETICAL_CODE_RE.exec(lender.displayName);
      if (codeMatch) record = byAccountCode.get(codeMatch[1].trim().toLowerCase());
    }
    if (!record) {
      unmatched.push(lender.displayName);
      continue;
    }
    matched++;

    const changes: Record<string, string> = {};
    if (lender.partyType === "BUSINESS" && !lender.companyName) changes.companyName = lender.displayName;
    if (lender.partyType === "INDIVIDUAL" && !lender.firstName && record.firstName) changes.firstName = record.firstName;
    if (lender.partyType === "INDIVIDUAL" && !lender.lastName && record.lastName) changes.lastName = record.lastName;
    if (!lender.phone && pickPhone(record)) changes.phone = pickPhone(record)!;
    if (!lender.mailingAddressLine1 && record.addressLine1) changes.mailingAddressLine1 = record.addressLine1;
    if (!lender.mailingCity && record.city) changes.mailingCity = record.city;
    if (!lender.mailingState && record.state) changes.mailingState = record.state;
    if (!lender.mailingZip && record.zip) changes.mailingZip = record.zip;

    if (Object.keys(changes).length === 0) {
      noChangeNeeded++;
      continue;
    }
    updates.push({ id: lender.id, displayName: lender.displayName, changes });
  }

  console.log(`\nMatched: ${matched}, no-change-needed: ${noChangeNeeded}, unmatched: ${unmatched.length}, to update: ${updates.length}`);
  console.log("\n--- Unmatched lender display names (no row in the CSV) ---");
  unmatched.forEach((n) => console.log(` - ${n}`));

  console.log("\n--- Proposed updates ---");
  updates.forEach((u) => console.log(` - ${u.displayName}:`, u.changes));

  if (!apply) {
    console.log("\nDry run only — pass --apply to write these changes.");
    return;
  }

  console.log("\nApplying updates...");
  for (const u of updates) {
    await db.update(parties).set(u.changes).where(eq(parties.id, u.id));
  }
  console.log(`Updated ${updates.length} lender parties.`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
