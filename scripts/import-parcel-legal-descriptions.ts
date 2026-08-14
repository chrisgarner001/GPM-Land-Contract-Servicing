import xlsx from "xlsx";
import { config } from "dotenv";
config({ path: ".env.local" });

/**
 * Fills in Properties.parcelNumber/legalDescription from the "LC group and
 * portfolio All including FICO" workbook (Warranty Deeds folder) — the only
 * place Tax ID Parcel Numbers and Legal Descriptions exist for this
 * portfolio outside the recorded deeds themselves. Matches by normalized
 * street address + city; never overwrites a field that already has a value.
 * Dry-run by default — pass --apply to actually write.
 */

const DEFAULT_PATH =
  "G:/Shared drives/Client Files/Investment Realty Services, LLC/Land Contract Sale DIRT Realty/Warranty Deeds/LC group and portfolio All including FICO 0525 MASTER WD Mail Merge .xlsx";

interface ExcelRecord {
  streetAddress: string;
  city: string | null;
  parcelNumber: string;
  legalDescription: string;
}

// Street-suffix words dropped entirely before comparing — the workbook and
// the DB disagree on whether/how they're spelled out (e.g. "Mark" vs.
// "Mark Ave.", "Toepfer Drive" vs. "TOEPFER DR") far more often than the
// underlying address actually differs.
const STREET_SUFFIXES = new Set([
  "AVE", "AVENUE", "ST", "STREET", "DR", "DRIVE", "RD", "ROAD", "BLVD", "BOULEVARD",
  "CT", "COURT", "LN", "LANE", "PL", "PLACE", "HWY", "HIGHWAY", "PKWY", "PARKWAY",
  "CIR", "CIRCLE", "TRL", "TRAIL", "WAY", "TER", "TERRACE",
]);

// A leading directional right after the house number ("S Marshall" vs.
// "Marshall", "East 10 Mile" vs. "E 10 Mile") is the other recurring
// disagreement between the workbook and the DB — drop it from both sides so
// its presence/spelling never blocks an otherwise-identical match.
const DIRECTIONALS = new Set(["N", "S", "E", "W", "NORTH", "SOUTH", "EAST", "WEST", "NE", "NW", "SE", "SW"]);

function normalizeAddress(streetAddress: string): string {
  const tokens = streetAddress
    .toUpperCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");
  while (tokens.length > 1 && STREET_SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop();
  if (tokens.length > 2 && DIRECTIONALS.has(tokens[1])) tokens.splice(1, 1);
  return tokens.join(" ");
}

function normalizeCity(city: string | null | undefined): string {
  return (city ?? "").toUpperCase().trim();
}

function toCleanString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}

async function run() {
  const { db } = await import("../src/db/client");
  const { eq } = await import("drizzle-orm");
  const { properties } = await import("../src/db/schema/parties");

  const apply = process.argv.includes("--apply");
  const filePath = process.argv[2]?.startsWith("--") || !process.argv[2] ? DEFAULT_PATH : process.argv[2];

  const wb = xlsx.readFile(filePath);

  function sheetRecords(sheetName: string): Record<string, unknown>[] {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) return [];
    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
    return rows.filter((r) => Object.values(r).some((v) => v !== null && v !== ""));
  }

  // "ALL  " is the consolidated master list (Groups 1-4 are its components) —
  // read it first so it wins ties; "Unencumbered payoff payments" covers a
  // handful of paid-off properties ALL doesn't carry, kept only as a
  // fallback for addresses ALL doesn't already have.
  const sheetsInPriorityOrder = ["ALL  ", "Unencumbered payoff payments"];

  const byAddressKey = new Map<string, ExcelRecord>();
  for (const sheetName of sheetsInPriorityOrder) {
    for (const row of sheetRecords(sheetName)) {
      const streetAddress = toCleanString(row["Building Address"]);
      const parcelNumber = toCleanString(row["Tax ID Number "]);
      const legalDescription = toCleanString(row["Legal Discription"]);
      if (!streetAddress || (!parcelNumber && !legalDescription)) continue;

      const city = toCleanString(row["Building City"]);
      const key = `${normalizeAddress(streetAddress)}|${normalizeCity(city)}`;
      if (!byAddressKey.has(key)) {
        byAddressKey.set(key, { streetAddress, city, parcelNumber: parcelNumber ?? "", legalDescription: legalDescription ?? "" });
      }
    }
  }

  console.log(`Parsed ${byAddressKey.size} unique address records with a parcel # or legal description.`);

  // Fallback for rows where the workbook's city disagrees with ours for the
  // same physical property (e.g. a Brownstown Township address the
  // workbook lists under "Brownstown" and we list under "Romulus") — only
  // used when the street-only key is unique across the whole workbook, so a
  // common street name recurring in different cities can't cross-match.
  const streetOnlyCounts = new Map<string, number>();
  for (const key of byAddressKey.keys()) {
    const streetOnly = key.split("|")[0];
    streetOnlyCounts.set(streetOnly, (streetOnlyCounts.get(streetOnly) ?? 0) + 1);
  }
  const byStreetOnlyKey = new Map<string, ExcelRecord>();
  for (const [key, record] of byAddressKey) {
    const streetOnly = key.split("|")[0];
    if (streetOnlyCounts.get(streetOnly) === 1) byStreetOnlyKey.set(streetOnly, record);
  }

  // Last-resort fallback for a street name that's word-spaced differently
  // between the two sources (e.g. "Cherry Hill" vs. "CherryHill") — compare
  // with ALL internal spaces removed too, still gated on uniqueness.
  const noSpaceCounts = new Map<string, number>();
  for (const streetOnly of streetOnlyCounts.keys()) {
    const noSpace = streetOnly.replace(/ /g, "");
    noSpaceCounts.set(noSpace, (noSpaceCounts.get(noSpace) ?? 0) + 1);
  }
  const byNoSpaceKey = new Map<string, ExcelRecord>();
  for (const [key, record] of byAddressKey) {
    const noSpace = key.split("|")[0].replace(/ /g, "");
    if (noSpaceCounts.get(noSpace) === 1) byNoSpaceKey.set(noSpace, record);
  }

  const dbProperties = await db
    .select({
      id: properties.id,
      streetAddress: properties.streetAddress,
      city: properties.city,
      parcelNumber: properties.parcelNumber,
      legalDescription: properties.legalDescription,
    })
    .from(properties);

  let matched = 0;
  let noChangeNeeded = 0;
  const updates: { id: string; streetAddress: string; changes: Record<string, string> }[] = [];
  const usedKeys = new Set<string>();

  for (const property of dbProperties) {
    const streetOnly = normalizeAddress(property.streetAddress);
    const key = `${streetOnly}|${normalizeCity(property.city)}`;
    const record = byAddressKey.get(key) ?? byStreetOnlyKey.get(streetOnly) ?? byNoSpaceKey.get(streetOnly.replace(/ /g, ""));
    if (!record) continue;
    matched++;
    usedKeys.add(byAddressKey.has(key) ? key : `${streetOnly}|${normalizeCity(record.city)}`);

    const changes: Record<string, string> = {};
    if (!property.parcelNumber && record.parcelNumber) changes.parcelNumber = record.parcelNumber;
    if (!property.legalDescription && record.legalDescription) changes.legalDescription = record.legalDescription;

    if (Object.keys(changes).length === 0) {
      noChangeNeeded++;
      continue;
    }
    updates.push({ id: property.id, streetAddress: property.streetAddress, changes });
  }

  const unmatchedExcelKeys = [...byAddressKey.keys()].filter((k) => !usedKeys.has(k));

  console.log(
    `\nDB properties: ${dbProperties.length}. Matched to a workbook row: ${matched} (no-change-needed: ${noChangeNeeded}, to update: ${updates.length}).`
  );
  console.log(`Workbook addresses with no matching DB property: ${unmatchedExcelKeys.length}`);
  unmatchedExcelKeys.forEach((k) => {
    const r = byAddressKey.get(k)!;
    console.log(` - ${r.streetAddress}, ${r.city ?? "—"}`);
  });

  console.log("\n--- Proposed updates ---");
  updates.forEach((u) => console.log(` - ${u.streetAddress}:`, u.changes));

  if (!apply) {
    console.log("\nDry run only — pass --apply to write these changes.");
    return;
  }

  console.log("\nApplying updates...");
  for (const u of updates) {
    await db.update(properties).set(u.changes).where(eq(properties.id, u.id));
  }
  console.log(`Updated ${updates.length} properties.`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
