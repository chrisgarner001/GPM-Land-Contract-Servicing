/**
 * One-time correction for lenderLedgerEntries.PAYMENT_CREDIT rows created by
 * this app's own live usage (sourcePaymentId set — NOT the historical TMO
 * bulk import, which never populates that column) before the late-fee fix:
 * creditLendersForPayment used to exclude LATE_FEE allocations entirely,
 * under the (incorrect) assumption that late fees were SGMS's own revenue.
 * They're the lender's money. This finds every (sourcePaymentId,
 * lenderPartyId) pair with a LATE_FEE allocation and no correction yet, and
 * inserts an offsetting entry — append-only ledger, same rule as every
 * other correction in this app (reversals, etc.) — rather than mutating
 * the original row.
 *
 * Grouped by (sourcePaymentId, lenderPartyId), summing ALL matching rows
 * (both signs) rather than processing each row independently — a payment
 * that was later reversed has BOTH a credit row and a reversal row sharing
 * the same sourcePaymentId, and correcting the credit alone while ignoring
 * the reversal would pay a late fee on money that was actually given back.
 * Net implied ownership comes out to ~0 for a fully-reversed payment, which
 * correctly produces no correction at all.
 *
 * The correction amount is the lender's NET ownership-weighted share of the
 * late fee, with NO additional servicing-fee deduction (the flat fee was
 * already taken out once on the surviving original entry). Ownership% is
 * derived from the already-stored interest share vs. the raw INTEREST
 * allocation on the same payment (falling back to PRINCIPAL if interest
 * was zero) rather than re-reading current contractParties — this
 * reproduces exactly what ownership% was actually used at credit time,
 * even if funding has since changed.
 *
 * Usage: npx tsx scripts/backfill-lender-late-fee-corrections.ts [--apply]
 * Dry-run by default; prints every correction it would make. Pass --apply
 * to actually insert them. Idempotent: a correction row is tagged with a
 * reference so re-running never double-corrects the same pair.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const CORRECTION_TAG = "late-fee-correction-v1";

async function main() {
  const apply = process.argv.includes("--apply");

  const { db } = await import("../src/db/client");
  const { lenderLedgerEntries } = await import("../src/db/schema/lending");
  const { paymentAllocations } = await import("../src/db/schema/payments");
  const { parties } = await import("../src/db/schema/parties");
  const { contracts } = await import("../src/db/schema/contracts");
  const { and, eq, isNotNull, inArray } = await import("drizzle-orm");
  const { getLatestLenderBalanceCents } = await import("../src/server/lenderLedger");

  const candidates = await db
    .select()
    .from(lenderLedgerEntries)
    .where(and(eq(lenderLedgerEntries.entryType, "PAYMENT_CREDIT"), isNotNull(lenderLedgerEntries.sourcePaymentId)));

  if (candidates.length === 0) {
    console.log("No PAYMENT_CREDIT rows from live app usage found.");
    process.exit(0);
  }

  const paymentIds = [...new Set(candidates.map((c) => c.sourcePaymentId!))];
  const allocationRows = await db.select().from(paymentAllocations).where(inArray(paymentAllocations.paymentId, paymentIds));

  const alreadyCorrected = await db
    .select({ sourcePaymentId: lenderLedgerEntries.sourcePaymentId, lenderPartyId: lenderLedgerEntries.lenderPartyId })
    .from(lenderLedgerEntries)
    .where(eq(lenderLedgerEntries.reference, CORRECTION_TAG));
  const correctedKeys = new Set(alreadyCorrected.map((r) => `${r.sourcePaymentId}:${r.lenderPartyId}`));

  // Group all rows (credits AND their reversals) by (sourcePaymentId, lenderPartyId).
  const groups = new Map<string, typeof candidates>();
  for (const credit of candidates) {
    const key = `${credit.sourcePaymentId}:${credit.lenderPartyId}`;
    const group = groups.get(key) ?? [];
    group.push(credit);
    groups.set(key, group);
  }

  const corrections: {
    lenderPartyId: string;
    lenderName: string;
    contractId: string | null;
    contractNumber: string | null;
    sourcePaymentId: string;
    netRowCount: number;
    lateFeeShareCents: number;
  }[] = [];

  for (const [key, group] of groups) {
    if (correctedKeys.has(key)) continue;
    // Already-corrected rows (lateFeeCents already set) shouldn't be
    // re-summed into the "raw" net — but they also shouldn't block the
    // group; only skip via correctedKeys above, which already handles it.
    if (group.some((r) => r.lateFeeCents != null)) continue;

    const [sourcePaymentId, lenderPartyId] = key.split(":");
    const allocations = allocationRows.filter((a) => a.paymentId === sourcePaymentId);
    const rawLateFee = allocations.filter((a) => a.allocationType === "LATE_FEE").reduce((s, a) => s + a.amountCents, 0);
    if (rawLateFee <= 0) continue;

    const rawInterest = allocations.filter((a) => a.allocationType === "INTEREST").reduce((s, a) => s + a.amountCents, 0);
    const rawPrincipal = allocations.filter((a) => a.allocationType === "PRINCIPAL").reduce((s, a) => s + a.amountCents, 0);

    const netInterestShare = group.reduce((s, r) => s + (r.interestCents ?? 0), 0);
    const netPrincipalShare = group.reduce((s, r) => s + (r.principalCents ?? 0), 0);

    let netOwnership: number | null = null;
    if (rawInterest > 0) netOwnership = netInterestShare / rawInterest;
    else if (rawPrincipal > 0) netOwnership = netPrincipalShare / rawPrincipal;
    if (netOwnership == null) {
      console.log(`SKIP ${key} — can't derive ownership% (no raw interest/principal to compare against).`);
      continue;
    }

    const lateFeeShareCents = Math.round(rawLateFee * netOwnership);
    if (lateFeeShareCents <= 0) continue; // fully reversed (or net-negative/zero) — correctly no correction

    const credit = group[0];
    const [lender] = await db.select({ displayName: parties.displayName }).from(parties).where(eq(parties.id, lenderPartyId));
    const contractNumber = credit.sourceContractId
      ? (await db.select({ contractNumber: contracts.contractNumber }).from(contracts).where(eq(contracts.id, credit.sourceContractId)))[0]?.contractNumber ?? null
      : null;

    corrections.push({
      lenderPartyId,
      lenderName: lender?.displayName ?? "Unknown",
      contractId: credit.sourceContractId,
      contractNumber,
      sourcePaymentId,
      netRowCount: group.length,
      lateFeeShareCents,
    });
  }

  if (corrections.length === 0) {
    console.log("No late-fee corrections needed — every candidate either has no late fee, nets to zero (reversed), or was already corrected.");
    process.exit(0);
  }

  console.log(`Found ${corrections.length} correction(s):`);
  let totalCents = 0;
  for (const c of corrections) {
    console.log(`  ${c.lenderName} (${c.contractNumber ?? "no contract"}), payment ${c.sourcePaymentId} [${c.netRowCount} ledger row(s) netted]: +$${(c.lateFeeShareCents / 100).toFixed(2)}`);
    totalCents += c.lateFeeShareCents;
  }
  console.log(`Total: $${(totalCents / 100).toFixed(2)}`);

  if (!apply) {
    console.log("\nDry run — pass --apply to insert these corrections.");
    process.exit(0);
  }

  const today = new Date().toISOString().slice(0, 10);
  for (const c of corrections) {
    await db.transaction(async (tx) => {
      const priorBalanceCents = await getLatestLenderBalanceCents(tx, c.lenderPartyId);
      await tx.insert(lenderLedgerEntries).values({
        lenderPartyId: c.lenderPartyId,
        sourceContractId: c.contractId,
        sourcePaymentId: c.sourcePaymentId,
        transactionDate: today,
        reference: CORRECTION_TAG,
        description: `Late fee correction (originally excluded — payment ${c.sourcePaymentId})`,
        amountReceivedCents: c.lateFeeShareCents,
        lateFeeCents: c.lateFeeShareCents,
        balanceCents: priorBalanceCents + c.lateFeeShareCents,
        entryType: "PAYMENT_CREDIT",
      });
    });
  }
  console.log(`\nInserted ${corrections.length} correction(s), totaling $${(totalCents / 100).toFixed(2)}.`);
  process.exit(0);
}

main();
