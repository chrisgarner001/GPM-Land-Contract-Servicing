import { eq, and, lte, gt, gte, asc, desc, inArray, sum } from "drizzle-orm";
import { db } from "@/db/client";
import { parties } from "@/db/schema/parties";
import { contracts } from "@/db/schema/contracts";
import { payments, paymentAllocations } from "@/db/schema/payments";
import { lenderLedgerEntries } from "@/db/schema/lending";
import { checks, checkLineItems } from "@/db/schema/checks";
import { bankAccounts } from "@/db/schema/setup";
import { getLatestLenderBalanceCents } from "./lenderLedger";

// TESTING SCAFFOLDING: real lender payments have already been made for
// activity through July 2026 (outside this app, via TMO) ahead of the
// eventual data migration/go-live. The Last Sweep floor keeps that already-
// paid historical activity out of the run without touching any of the
// underlying rows — at real go-live, after importing fresh TMO data, this
// constant should move (by hand, in code) to the actual go-live cutover
// date. Nothing else about this feature depends on this constant.
export const DEFAULT_SWEEP_BASELINE_DATE = "2026-07-31";

// The page's default Last Sweep value — deliberately NOT auto-advanced to
// "the most recent distribution's date" anymore. That auto-advance used to
// exist so an already-swept lender's stale-looking baseline wouldn't scare
// staff on the next page load, but getEffectiveSweepFloor/
// getLendersWithOutstandingBalance now trust each lender's OWN last
// distribution's precise createdAt for that instead. Auto-advancing this
// global value to "today" the moment ANY lender is swept was actively
// harmful: as an end-of-day floor, it silently blocked every OTHER
// lender's same-day credits too (confirmed live — a lender with no
// distribution of their own fell back to this value and a same-day payment
// disappeared). Now this baseline only ever matters for a lender who has
// never been swept, where it should stay pinned at the fixed cutover.
export async function getDefaultSweepBaselineDate(): Promise<string> {
  return DEFAULT_SWEEP_BASELINE_DATE;
}

export interface LenderPaymentRunLineItem {
  id: string;
  contractId: string | null;
  contractNumber: string | null;
  paymentDate: string | null;
  interestCents: number;
  principalCents: number;
  servicingFeeCents: number;
  amountReceivedCents: number;
  // The lender's ownership-weighted share of any LATE_FEE allocation on the
  // source payment — late fees are lender revenue, not SGMS's, and this is
  // ALREADY included in amountReceivedCents; broken out here purely for
  // display. Null/0 for rows created before this column existed.
  lateChargesCents: number;
  // Informational only — the OTHER_FEE portion of the SAME source borrower
  // payment. That revenue stays with SGMS and is never split by ownership%
  // or included in amountReceivedCents — shown so staff can see the full
  // payment a lender's share came from. When a contract has co-lenders,
  // each lender's row for the same payment shows this same (whole, un-
  // split) figure — it's context, not a distribution.
  otherChargesCents: number;
  // The source payment this credit came from — null for rows with no
  // sourcePaymentId (e.g. legacy-imported credits). Used only to target the
  // "include anyway" override action; not otherwise displayed.
  paymentId: string | null;
  // Null for rows with no source payment (no hold applies). Purely
  // informational — heldForRelease is the field that actually gates the run.
  releaseDate: string | null;
  // True when this payment's releaseDate hasn't arrived yet (relative to
  // runDate) and it hasn't been explicitly overridden — held items are still
  // included here for visibility, but excluded from balanceCents and from
  // what processLenderDistribution actually sweeps.
  heldForRelease: boolean;
}

// OTHER_FEE totals for a batch of source payments, keyed by paymentId —
// batch-queried once per call site rather than per line item. LATE_FEE is
// NOT reconstructed here — it's the lender's own money, already stored as
// an ownership-weighted share directly on the ledger row (lateFeeCents).
async function getOtherChargesByPaymentId(paymentIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (paymentIds.length === 0) return map;

  const rows = await db
    .select({ paymentId: paymentAllocations.paymentId, total: sum(paymentAllocations.amountCents) })
    .from(paymentAllocations)
    .where(and(inArray(paymentAllocations.paymentId, paymentIds), eq(paymentAllocations.allocationType, "OTHER_FEE")))
    .groupBy(paymentAllocations.paymentId);

  for (const row of rows) map.set(row.paymentId, Number(row.total ?? 0));
  return map;
}

export interface LenderRunBlock {
  lenderPartyId: string;
  displayName: string;
  preferredPaymentMethod: "CHECK" | "ACH" | null;
  balanceCents: number;
  items: LenderPaymentRunLineItem[];
}

// sweepBaselineDate is a plain business date (a TMO-cutover marker with no
// real timestamp behind it) — treated as the END of that day, so anything
// dated on/before it is excluded regardless of time.
function baselineDateToInstant(sweepBaselineDate: string): Date {
  return new Date(`${sweepBaselineDate}T23:59:59.999Z`);
}

// The instant after which a lender's credits count as outstanding.
//
// NOT simply "whichever of the two instants is later" — sweepBaselineDate
// only carries day-level meaning (a TMO-cutover marker, or the UI's
// auto-advanced default), and comparing it as "end of that day" against a
// real distribution's precise createdAt would let it dominate the ENTIRE
// day of any distribution: a same-day distribution's createdAt (necessarily
// earlier than 23:59:59.999 on its own day) always loses to "end of day,"
// permanently hiding any credit posted later that same day. So: trust the
// lender's OWN last distribution's createdAt outright whenever that
// distribution landed on/after the baseline date (it's a real in-app sweep,
// full stop) — only fall back to the coarse baseline-as-end-of-day when
// their last recorded distribution predates the baseline (stale/pre-go-live
// data, like an old TMO-imported row, that the baseline is specifically
// there to override).
async function getEffectiveSweepFloor(lenderPartyId: string, runDate: string, sweepBaselineDate: string): Promise<Date> {
  const [lastDistribution] = await db
    .select({ createdAt: lenderLedgerEntries.createdAt, transactionDate: lenderLedgerEntries.transactionDate })
    .from(lenderLedgerEntries)
    .where(
      and(
        eq(lenderLedgerEntries.lenderPartyId, lenderPartyId),
        eq(lenderLedgerEntries.entryType, "DISTRIBUTION"),
        lte(lenderLedgerEntries.transactionDate, runDate)
      )
    )
    .orderBy(desc(lenderLedgerEntries.createdAt))
    .limit(1);

  return lastDistribution && lastDistribution.transactionDate >= sweepBaselineDate
    ? lastDistribution.createdAt
    : baselineDateToInstant(sweepBaselineDate);
}

// A reversed payment doesn't mark or remove its original lender credit —
// reverseLenderCreditsForPayment (lenderLedger.ts) inserts a SECOND
// PAYMENT_CREDIT row with the same sourcePaymentId and every amount field
// negated, so the two net to zero. Left alone, both rows still pass every
// filter here and show up as two stray line items (confirmed live: a lender
// showed "9 payments across one contract" when reversed test pairs were
// counted individually instead of disappearing, per this feature's own
// documented spec). This drops exactly those offsetting pairs — grouped by
// sourcePaymentId, only when more than one row shares it AND they net to
// zero — while leaving any genuinely-outstanding row (including a lone
// row with no sourcePaymentId at all, e.g. a legacy-imported credit) alone.
function dropOffsettingReversalPairs<T extends { sourcePaymentId: string | null; amountReceivedCents: number | null }>(
  rows: T[]
): T[] {
  const groups = new Map<string, T[]>();
  const standalone: T[] = [];
  for (const row of rows) {
    if (!row.sourcePaymentId) {
      standalone.push(row);
      continue;
    }
    const list = groups.get(row.sourcePaymentId) ?? [];
    list.push(row);
    groups.set(row.sourcePaymentId, list);
  }

  const kept = [...standalone];
  for (const group of groups.values()) {
    const netCents = group.reduce((s, r) => s + (r.amountReceivedCents ?? 0), 0);
    if (netCents === 0 && group.length > 1) continue; // fully-offsetting reversal pair — drop entirely
    kept.push(...group);
  }
  return kept;
}

// Reconstructs the line items behind a lender's outstanding balance: every
// PAYMENT_CREDIT row dated after their effective sweep floor (see above)
// through runDate. Always returns the FULL set, uncapped, INCLUDING items
// still held under their source payment's releaseDate (heldForRelease:
// true) — callers that sweep money must filter those out themselves rather
// than have them silently missing from this list, since a held item still
// needs to be visible for the "include anyway" override. Any display-only
// truncation belongs in the page component.
export async function getLineItemsSinceLastDistribution(
  lenderPartyId: string,
  runDate: string,
  sweepBaselineDate: string
): Promise<LenderPaymentRunLineItem[]> {
  const floorInstant = await getEffectiveSweepFloor(lenderPartyId, runDate, sweepBaselineDate);

  const rows = await db
    .select({
      id: lenderLedgerEntries.id,
      contractId: lenderLedgerEntries.sourceContractId,
      contractNumber: contracts.contractNumber,
      sourcePaymentId: lenderLedgerEntries.sourcePaymentId,
      paymentDate: payments.receivedDate,
      interestCents: lenderLedgerEntries.interestCents,
      principalCents: lenderLedgerEntries.principalCents,
      lateFeeCents: lenderLedgerEntries.lateFeeCents,
      servicingFeeCents: lenderLedgerEntries.servicingFeeCents,
      amountReceivedCents: lenderLedgerEntries.amountReceivedCents,
      releaseDate: payments.releaseDate,
      releaseOverride: payments.releaseOverride,
    })
    .from(lenderLedgerEntries)
    .leftJoin(contracts, eq(lenderLedgerEntries.sourceContractId, contracts.id))
    .leftJoin(payments, eq(lenderLedgerEntries.sourcePaymentId, payments.id))
    .where(
      and(
        eq(lenderLedgerEntries.lenderPartyId, lenderPartyId),
        eq(lenderLedgerEntries.entryType, "PAYMENT_CREDIT"),
        lte(lenderLedgerEntries.transactionDate, runDate),
        gt(lenderLedgerEntries.createdAt, floorInstant)
      )
    )
    .orderBy(asc(lenderLedgerEntries.transactionDate), asc(lenderLedgerEntries.id));

  const netRows = dropOffsettingReversalPairs(rows);
  const otherChargesByPaymentId = await getOtherChargesByPaymentId(netRows.map((r) => r.sourcePaymentId).filter((id): id is string => id != null));

  return netRows.map((r) => ({
    id: r.id,
    contractId: r.contractId,
    contractNumber: r.contractNumber,
    paymentDate: r.paymentDate,
    interestCents: r.interestCents ?? 0,
    principalCents: r.principalCents ?? 0,
    servicingFeeCents: r.servicingFeeCents ?? 0,
    amountReceivedCents: r.amountReceivedCents ?? 0,
    lateChargesCents: r.lateFeeCents ?? 0,
    otherChargesCents: (r.sourcePaymentId ? otherChargesByPaymentId.get(r.sourcePaymentId) : undefined) ?? 0,
    paymentId: r.sourcePaymentId,
    releaseDate: r.releaseDate,
    heldForRelease: r.releaseDate !== null && r.releaseDate > runDate && !r.releaseOverride,
  }));
}

// Eligibility is NOT filtered through "currently active" contractParties —
// a lender whose funding has since ended can still be owed a final
// distribution for activity credited while they were active. The total
// shown is always the live sum of the same line items returned alongside
// it — never a separately-stored balance — so the header total and the
// breakdown table can never disagree.
//
// Deliberately batch-queried (3 queries total) rather than looping
// getLineItemsSinceLastDistribution per lender — an earlier version did
// exactly that (2 round trips × every lender) and timed out in production
// once there were enough lenders for the per-request connection/latency
// overhead to add up. Every lender's effective floor is still computed
// individually, just in memory instead of via a separate query each.
export async function getLendersWithOutstandingBalance(runDate: string, sweepBaselineDate: string): Promise<LenderRunBlock[]> {
  const baselineInstant = baselineDateToInstant(sweepBaselineDate);

  const [lastDistributionRows, creditRows, lenderRows] = await Promise.all([
    db
      .selectDistinctOn([lenderLedgerEntries.lenderPartyId], {
        lenderPartyId: lenderLedgerEntries.lenderPartyId,
        createdAt: lenderLedgerEntries.createdAt,
        transactionDate: lenderLedgerEntries.transactionDate,
      })
      .from(lenderLedgerEntries)
      .where(and(eq(lenderLedgerEntries.entryType, "DISTRIBUTION"), lte(lenderLedgerEntries.transactionDate, runDate)))
      .orderBy(lenderLedgerEntries.lenderPartyId, desc(lenderLedgerEntries.createdAt)),
    db
      .select({
        id: lenderLedgerEntries.id,
        lenderPartyId: lenderLedgerEntries.lenderPartyId,
        createdAt: lenderLedgerEntries.createdAt,
        contractId: lenderLedgerEntries.sourceContractId,
        contractNumber: contracts.contractNumber,
        sourcePaymentId: lenderLedgerEntries.sourcePaymentId,
        paymentDate: payments.receivedDate,
        interestCents: lenderLedgerEntries.interestCents,
        principalCents: lenderLedgerEntries.principalCents,
        lateFeeCents: lenderLedgerEntries.lateFeeCents,
        servicingFeeCents: lenderLedgerEntries.servicingFeeCents,
        amountReceivedCents: lenderLedgerEntries.amountReceivedCents,
        releaseDate: payments.releaseDate,
        releaseOverride: payments.releaseOverride,
      })
      .from(lenderLedgerEntries)
      .leftJoin(contracts, eq(lenderLedgerEntries.sourceContractId, contracts.id))
      .leftJoin(payments, eq(lenderLedgerEntries.sourcePaymentId, payments.id))
      .where(
        and(
          eq(lenderLedgerEntries.entryType, "PAYMENT_CREDIT"),
          lte(lenderLedgerEntries.transactionDate, runDate),
          // Coarse, date-level pre-filter only (safely inclusive — >=, not
          // >) — the precise createdAt-based floor, which can legitimately
          // be as early as midnight of the baseline date itself (a lender
          // swept ON that date), is applied per-lender below. A strict >
          // here would drop same-day rows before the per-lender check ever
          // saw them — exactly the bug this whole fix is for, just one
          // query up.
          gte(lenderLedgerEntries.transactionDate, sweepBaselineDate)
        )
      )
      .orderBy(asc(lenderLedgerEntries.transactionDate), asc(lenderLedgerEntries.id)),
    db.select({ id: parties.id, displayName: parties.displayName, preferredPaymentMethod: parties.preferredPaymentMethod }).from(parties),
  ]);

  // Same reasoning as getEffectiveSweepFloor: trust a lender's own last
  // distribution's precise createdAt outright when it's on/after the
  // baseline date; only fall back to the coarse baseline-as-end-of-day for
  // a lender whose last recorded distribution predates the baseline.
  const floorByLender = new Map(
    lastDistributionRows.map((r) => [r.lenderPartyId, r.transactionDate >= sweepBaselineDate ? r.createdAt : baselineInstant])
  );
  const lenderById = new Map(lenderRows.map((l) => [l.id, l]));
  const otherChargesByPaymentId = await getOtherChargesByPaymentId(creditRows.map((r) => r.sourcePaymentId).filter((id): id is string => id != null));

  // Grouped by lender first (raw rows, still past-floor-filtered) so
  // dropOffsettingReversalPairs only ever pairs up a reversal against its
  // OWN lender's original credit — a payment split across multiple lenders'
  // ownership% produces one PAYMENT_CREDIT row per lender sharing the same
  // sourcePaymentId, and those must never net against each other.
  const rawRowsByLender = new Map<string, typeof creditRows>();
  for (const row of creditRows) {
    const floorInstant = floorByLender.get(row.lenderPartyId) ?? baselineInstant;
    if (row.createdAt <= floorInstant) continue; // credited on/before this lender's own effective floor

    const list = rawRowsByLender.get(row.lenderPartyId) ?? [];
    list.push(row);
    rawRowsByLender.set(row.lenderPartyId, list);
  }

  const itemsByLender = new Map<string, LenderPaymentRunLineItem[]>();
  for (const [lenderPartyId, rawRows] of rawRowsByLender) {
    const netRows = dropOffsettingReversalPairs(rawRows);
    itemsByLender.set(
      lenderPartyId,
      netRows.map((row) => ({
        id: row.id,
        contractId: row.contractId,
        contractNumber: row.contractNumber,
        paymentDate: row.paymentDate,
        interestCents: row.interestCents ?? 0,
        principalCents: row.principalCents ?? 0,
        servicingFeeCents: row.servicingFeeCents ?? 0,
        amountReceivedCents: row.amountReceivedCents ?? 0,
        lateChargesCents: row.lateFeeCents ?? 0,
        otherChargesCents: (row.sourcePaymentId ? otherChargesByPaymentId.get(row.sourcePaymentId) : undefined) ?? 0,
        paymentId: row.sourcePaymentId,
        releaseDate: row.releaseDate,
        heldForRelease: row.releaseDate !== null && row.releaseDate > runDate && !row.releaseOverride,
      }))
    );
  }

  const blocks: LenderRunBlock[] = [];
  for (const [lenderPartyId, items] of itemsByLender) {
    // Held items stay outstanding but are excluded from the swept balance —
    // still shown so staff can see and, if needed, override them.
    const balanceCents = items.filter((i) => !i.heldForRelease).reduce((s, i) => s + i.amountReceivedCents, 0);
    const hasHeldItems = items.some((i) => i.heldForRelease);
    if (balanceCents <= 0 && !hasHeldItems) continue;
    const lender = lenderById.get(lenderPartyId);
    blocks.push({
      lenderPartyId,
      displayName: lender?.displayName ?? "Unknown",
      preferredPaymentMethod: lender?.preferredPaymentMethod ?? null,
      balanceCents,
      items,
    });
  }

  return blocks.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

// Produces the distribution record (a check, or a synthetic-reference ACH
// row — no real bank transfer, see feature docs) and records a DISTRIBUTION
// row sweeping the lender as of runDate. Re-fetches line items server-side
// rather than trusting client-submitted totals, so a payment landing
// between page load and this click is always caught.
export async function processLenderDistribution(params: {
  lenderPartyId: string;
  runDate: string;
  sweepBaselineDate: string;
  paymentMethod: "CHECK" | "ACH";
  checkNumber?: string;
}): Promise<void> {
  const { lenderPartyId, runDate, sweepBaselineDate, paymentMethod, checkNumber } = params;

  if (paymentMethod === "CHECK" && !checkNumber?.trim()) {
    throw new Error("Check number is required to process a Check distribution.");
  }

  const [lender] = await db.select({ displayName: parties.displayName }).from(parties).where(eq(parties.id, lenderPartyId));
  if (!lender) throw new Error("Lender not found.");

  const allItems = await getLineItemsSinceLastDistribution(lenderPartyId, runDate, sweepBaselineDate);
  // Held items (releaseDate not yet reached, no override) stay outstanding
  // for a future run — they're never swept here.
  const items = allItems.filter((i) => !i.heldForRelease);
  if (items.length === 0) {
    throw new Error("This lender has no outstanding activity to distribute as of this run date.");
  }

  const totalCents = items.reduce((s, i) => s + i.amountReceivedCents, 0);
  if (totalCents <= 0) {
    throw new Error("Nothing to distribute — outstanding balance is zero or negative.");
  }

  // One checkLineItems row per contract, matching the historical shape of a
  // lender check (multiple payments on the same contract since the last
  // sweep are aggregated into a single line for that contract).
  const byContract = new Map<
    string,
    {
      contractId: string | null;
      amountCents: number;
      interestCents: number;
      principalCents: number;
      servicingFeeCents: number;
      lateChargesCents: number;
      otherChargesCents: number;
    }
  >();
  for (const item of items) {
    const key = item.contractId ?? `__none_${item.id}`;
    const existing = byContract.get(key) ?? {
      contractId: item.contractId,
      amountCents: 0,
      interestCents: 0,
      principalCents: 0,
      servicingFeeCents: 0,
      lateChargesCents: 0,
      otherChargesCents: 0,
    };
    existing.amountCents += item.amountReceivedCents;
    existing.interestCents += item.interestCents;
    existing.principalCents += item.principalCents;
    existing.servicingFeeCents += item.servicingFeeCents;
    // lateChargesCents is ALREADY included in amountCents (see
    // LenderPaymentRunLineItem) — tracked separately here only so the check
    // stub can show the breakdown. otherChargesCents is informational only
    // (OTHER_FEE stays with SGMS) and never part of amountCents/totalCents.
    existing.lateChargesCents += item.lateChargesCents;
    existing.otherChargesCents += item.otherChargesCents;
    byContract.set(key, existing);
  }

  // checks.payeeCode has no FK to parties — plain text by design (see
  // checks.ts schema comment) — so a programmatically-created distribution
  // simply reuses the lender's display name for both fields.
  const payeeCode = lender.displayName;
  const resolvedCheckNumber = paymentMethod === "CHECK" ? checkNumber!.trim() : `ACH-${runDate}-${payeeCode}`;

  // Lender distributions always clear Owner Trust — recorded on the check so
  // the Accounting > Check Register report can classify it without relying
  // on the payee-name heuristic (see checkClassification.ts).
  const [ownerTrust] = await db.select().from(bankAccounts).where(eq(bankAccounts.label, "Owner Trust"));

  await db.transaction(async (tx) => {
    const [check] = await tx
      .insert(checks)
      .values({
        checkNumber: resolvedCheckNumber,
        checkDate: runDate,
        payeeCode,
        payeeName: lender.displayName,
        totalAmountCents: totalCents,
        paymentMethod,
        bankAccountId: ownerTrust?.id ?? null,
      })
      .returning();

    await tx.insert(checkLineItems).values(
      Array.from(byContract.values()).map((c) => ({
        checkId: check.id,
        contractId: c.contractId,
        amountCents: c.amountCents,
        servicingFeeCents: c.servicingFeeCents,
        interestCents: c.interestCents,
        principalCents: c.principalCents,
        // lateChargesCents is already part of amountCents/totalCents (see
        // LenderPaymentRunLineItem) — this is just the breakdown for the
        // check stub. chargesAmountCents (OTHER_FEE) stays informational.
        lateChargesCents: c.lateChargesCents,
        chargesAmountCents: c.otherChargesCents,
      }))
    );

    // The real running balance keeps reflecting complete history — the
    // sweep baseline only bounds what THIS feature treats as "outstanding
    // to distribute," it never truncates the authoritative ledger balance
    // other consumers (lender portal, lender detail page) read.
    const priorBalanceCents = await getLatestLenderBalanceCents(tx, lenderPartyId);
    await tx.insert(lenderLedgerEntries).values({
      lenderPartyId,
      sourceContractId: null,
      transactionDate: runDate,
      description: paymentMethod === "CHECK" ? "Lender Check" : "Lender ACH",
      amountPaidOutCents: totalCents,
      balanceCents: priorBalanceCents - totalCents,
      entryType: "DISTRIBUTION",
    });
  });
}

// Staff-initiated "include anyway" from the Lender Payment Run screen — sets
// the flag that bypasses this one payment's releaseDate hold. A payment-
// level flag rather than per-lender-row: on a split-funded contract the same
// source payment produces one PAYMENT_CREDIT row per lender, and overriding
// it should release all of them together, not just whichever lender staff
// happened to be looking at.
export async function overridePaymentRelease(paymentId: string): Promise<void> {
  await db.update(payments).set({ releaseOverride: true }).where(eq(payments.id, paymentId));
}
