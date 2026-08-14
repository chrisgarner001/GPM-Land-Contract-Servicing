import { config } from "dotenv";
import Decimal from "decimal.js";
import { parseFile, type ParsedAccount } from "./parse-tmo-export";
import { generateSchedule, solveForTermMonths } from "../src/domain/amortization/generateSchedule";
import { calculateLenderShare } from "../src/domain/lending/calculateLenderShare";

// --- Parsing helpers -------------------------------------------------------

function moneyToCents(raw: string | null): number | null {
  if (!raw || raw === "N/A") return null;
  const negative = raw.trim().startsWith("(") && raw.trim().endsWith(")");
  const digits = raw.replace(/[^0-9.]/g, "");
  if (digits === "") return null;
  const cents = new Decimal(digits).mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  return negative ? -cents : cents;
}

function percentToDecimalString(raw: string | null): string | null {
  if (!raw || raw === "N/A") return null;
  const num = raw.replace("%", "").trim();
  return num === "" ? null : num;
}

function mdyToIso(raw: string | null): string | null {
  if (!raw || raw === "N/A") return null;
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mo, d, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function monthsBetween(startIso: string, endIso: string): number {
  const [sy, sm] = startIso.split("-").map(Number);
  const [ey, em] = endIso.split("-").map(Number);
  return (ey - sy) * 12 + (em - sm) + 1; // inclusive of both endpoints
}

const LIEN_PRIORITY_MAP: Record<string, "1ST" | "2ND" | "3RD" | "4TH" | "5TH" | "6TH" | "7TH" | "8TH" | "OTHER"> = {
  "1st": "1ST",
  "2nd": "2ND",
  "3rd": "3RD",
  "4th": "4TH",
  "5th": "5TH",
  "6th": "6TH",
  "7th": "7TH",
  "8th": "8TH",
};

function toLienPriority(raw: string | null): "1ST" | "2ND" | "3RD" | "4TH" | "5TH" | "6TH" | "7TH" | "8TH" | "OTHER" {
  if (!raw) return "1ST";
  return LIEN_PRIORITY_MAP[raw.toLowerCase()] ?? "OTHER";
}

function cityStateZipParts(raw: string | null): { city: string | null; state: string | null; zip: string | null } {
  if (!raw) return { city: null, state: null, zip: null };
  const m = raw.match(/^(.*)\s+([A-Z]{2})\s+(\d{5})$/);
  if (!m) return { city: raw, state: null, zip: null };
  return { city: m[1].trim(), state: m[2], zip: m[3] };
}

interface MappedContract {
  accountNumber: string;
  contractNumber: string;
  buyers: { name: string; ssnLast4: string | null; role: "BUYER" | "CO_BUYER" }[];
  property: { address: string | null; city: string | null; state: string | null; zip: string | null };
  originalPrincipalCents: number;
  currentPrincipalBalanceCents: number;
  interestRateAnnual: string;
  lienPriority: "1ST" | "2ND" | "3RD" | "4TH" | "5TH" | "6TH" | "7TH" | "8TH" | "OTHER";
  amortizationTermMonths: number;
  numberOfPayments: number;
  hasBalloon: boolean;
  balloonAmountCents: number | null;
  balloonDueDate: string | null;
  paymentAmountCents: number;
  originationDate: string;
  firstPaymentDate: string;
  maturityDate: string | null;
  nextPaymentDate: string | null;
  paidOffDate: string | null;
  status: "ACTIVE" | "PAID_OFF";
  lateFeeAmountCents: number | null;
  graceDays: number | null;
  scheduleRows: ReturnType<typeof generateSchedule>;
  payments: {
    date: string;
    amountCents: number;
    reference: string | null;
    description: string | null;
    allocations: { type: "PRINCIPAL" | "INTEREST" | "ESCROW_TAX" | "LATE_FEE" | "OTHER_FEE" | "SUSPENSE"; amountCents: number }[];
  }[];
  trustActivity: {
    date: string;
    reference: string | null;
    payeeOrPayer: string | null;
    description: string | null;
    amountPaidOutCents: number | null;
    amountReceivedCents: number | null;
    balanceCents: number | null;
  }[];
  lenders: {
    // The true identity key (TMO's own "Lender Account" code) — NOT the
    // display name, which can be shared by genuinely different investors
    // (e.g. multiple people custodied under the same "ETC Custodian FBO").
    lenderIdentityKey: string;
    lenderName: string; // disambiguated for display when the raw name is ambiguous
    ownershipPercent: string; // decimal string, e.g. "100.000" or "60.000"
    brokerServicingFeeCents: number;
    isCurrent: boolean; // false = former owner (0% — contract has been transferred), kept for historical record only
  }[];
  // True when no lender on this contract can be reliably identified as the
  // current owner (multiple lenders, all showing 0%) — payout reconstruction
  // is skipped entirely for contracts like this rather than guessing.
  skipLenderPayouts: boolean;
  warnings: string[];
}

/**
 * Some lenders share a generic display name across genuinely different
 * underlying investors — confirmed real case: "ETC Custodian FBO" (a
 * self-directed IRA custodian) is shared by at least 3 distinct investors,
 * distinguished only by their "Lender Account" code (e.g. "FBOJIMROTH" vs
 * "FBOJAMESWO"). That code — not the display name — is the true identity
 * key; this pre-pass finds every name that maps to more than one code so
 * mapAccount() can disambiguate the display name for those specific cases
 * (leaving the vast majority of lenders, which have unique names, untouched).
 */
function findAmbiguousLenderNames(accounts: ParsedAccount[]): Set<string> {
  const nameToAccounts = new Map<string, Set<string>>();
  for (const acct of accounts) {
    for (const l of acct.lenderAssignments) {
      if (!l.lenderName || !l.lenderAccount) continue;
      if (!nameToAccounts.has(l.lenderName)) nameToAccounts.set(l.lenderName, new Set());
      nameToAccounts.get(l.lenderName)!.add(l.lenderAccount);
    }
  }
  const ambiguous = new Set<string>();
  for (const [name, codes] of nameToAccounts) {
    if (codes.size > 1) ambiguous.add(name);
  }
  return ambiguous;
}

function mapAccount(acct: ParsedAccount, ambiguousLenderNames: Set<string>): MappedContract | null {
  const warnings = [...acct.warnings];
  const lt = acct.loanTerms;
  if (!lt) {
    warnings.push("Skipped: no loan terms");
    return null;
  }

  const originalPrincipalCents = moneyToCents(lt.originalAmount);
  const paymentAmountCents = moneyToCents(lt.paymentAmount);
  const firstPaymentDate = mdyToIso(lt.firstPaymentDate);
  const originationDate = mdyToIso(lt.closingDate) ?? firstPaymentDate;
  const maturityDate = mdyToIso(lt.maturityDate);
  const nextPaymentDate = mdyToIso(lt.nextPaymentDate);
  const interestRateAnnual = percentToDecimalString(lt.noteRatePercent);

  if (originalPrincipalCents === null || paymentAmountCents === null || !firstPaymentDate || !interestRateAnnual) {
    warnings.push("Skipped: missing a required loan-terms field (amount/payment/first payment date/rate)");
    return null;
  }

  // Every loan in this export is marked "Fully Amortized" by TMO, so solve for
  // the true amortization length algebraically from principal/rate/payment
  // rather than trusting the on-file maturity date — that date very often
  // reflects a call/balloon provision, not the payment's actual amortization
  // design (confirmed on real data: a $549.55 payment on $74,895 at 8% is a
  // 360-month amortization, not the ~73 months a 2020->2026 maturity span
  // would imply). This turned out to be the norm, not an edge case: ~190/214
  // contracts in this file are structured as long-amortization/short-balloon
  // land contracts, so hasBalloon/balloonDueDate/balloonAmountCents need to
  // reflect that rather than silently generating a full-term schedule.
  let amortizationTermMonths: number;
  let solveFailed = false;
  try {
    const solved = solveForTermMonths(originalPrincipalCents, Number(interestRateAnnual), paymentAmountCents);
    if (!Number.isFinite(solved) || solved < 1 || solved > 600) throw new Error(`out of sane range: ${solved}`);
    amortizationTermMonths = solved;
  } catch (e) {
    solveFailed = true;
    amortizationTermMonths = maturityDate ? Math.max(monthsBetween(firstPaymentDate, maturityDate), 1) : 360;
    warnings.push(`Could not solve amortization term algebraically (${(e as Error).message}); fell back to ${maturityDate ? "maturity-date-derived" : "default"} term of ${amortizationTermMonths} months`);
  }

  let hasBalloon = false;
  let numberOfPayments = amortizationTermMonths;
  if (!solveFailed && maturityDate) {
    const dateDerivedTerm = Math.max(monthsBetween(firstPaymentDate, maturityDate), 1);
    if (dateDerivedTerm < amortizationTermMonths - 6) {
      hasBalloon = true;
      numberOfPayments = dateDerivedTerm;
    }
  }

  const buyers: MappedContract["buyers"] = acct.borrowers
    .filter((b) => b.name)
    .map((b) => ({
      name: b.name!,
      ssnLast4: b.ssnLast4,
      role: b.borrowerType?.toLowerCase().includes("co") ? "CO_BUYER" : "BUYER",
    }));
  if (buyers.length === 0) warnings.push("No borrower name found");

  const propCsz = cityStateZipParts(acct.property?.cityStateZip ?? null);

  const status: MappedContract["status"] = lt.paymentAdjustmentStatus === "Paid" ? "PAID_OFF" : "ACTIVE";

  const payments: MappedContract["payments"] = [];
  for (const t of acct.transactions) {
    const date = mdyToIso(t.transactionDate);
    const amountCents = moneyToCents(t.transactionAmount);
    if (!date || amountCents === null) continue; // already logged structurally upstream; skip unparseable row
    const allocations: MappedContract["payments"][number]["allocations"] = [];
    const push = (type: (typeof allocations)[number]["type"], raw: string | null) => {
      const cents = moneyToCents(raw);
      if (cents !== null && cents !== 0) allocations.push({ type, amountCents: cents });
    };
    push("INTEREST", t.interestDistribution);
    push("PRINCIPAL", t.principalDistribution);
    push("LATE_FEE", t.lateCharges);
    push("OTHER_FEE", t.other);
    push("SUSPENSE", t.reserve);
    push("ESCROW_TAX", t.impound);
    payments.push({ date, amountCents, reference: t.reference, description: t.description, allocations });
  }

  const trustActivity: MappedContract["trustActivity"] = [];
  for (const t of acct.trustActivity) {
    const date = mdyToIso(t.transactionDate);
    if (!date) continue;
    trustActivity.push({
      date,
      reference: t.reference,
      payeeOrPayer: t.toWhomPaidOrFromWhomReceived,
      description: t.description,
      amountPaidOutCents: moneyToCents(t.amountPaidOut),
      amountReceivedCents: moneyToCents(t.amountReceived),
      balanceCents: moneyToCents(t.balance),
    });
  }

  // Lender assignment: confirmed against the business that (a) a flat dollar
  // fee is always used (never a genuine %-of-principal component — the flat
  // amount is configured via EITHER "Plus Amt" or "Minimum", both read as a
  // flat addition when % is 0; taking max(plusAmt, minimum) resolves it
  // either way), and (b) a contract can list multiple lenders representing a
  // TRANSFER HISTORY rather than simultaneous fractional co-ownership — 0%
  // means "former owner, since transferred out", nonzero means "current
  // owner". Only the current, nonzero-% owner(s) matter for payouts; the
  // business doesn't need historical payments retroactively re-split across
  // former owners, so former owners are kept only as a historical record
  // (no ContractParty/ledger entries generated for them).
  const lenders: MappedContract["lenders"] = [];
  for (const l of acct.lenderAssignments) {
    if (!l.lenderName || !l.pctOwned) continue;
    const ownershipPercent = l.pctOwned.replace("%", "").trim();
    const plusAmtCents = moneyToCents(l.brokerFeePlusAmt) ?? 0;
    const minimumCents = moneyToCents(l.brokerFeeMinimum) ?? 0;
    const brokerServicingFeeCents = Math.max(plusAmtCents, minimumCents);
    const pctOfPrin = l.brokerFeePctOfPrin?.replace("%", "").trim();
    if (pctOfPrin && pctOfPrin !== "0.000") {
      warnings.push(
        `Lender "${l.lenderName}" has a nonzero broker fee % of principal (${l.brokerFeePctOfPrin}) — used max(plusAmt, minimum) = ${brokerServicingFeeCents} cents as the flat fee, but this assignment isn't purely flat like the rest`
      );
    }
    const lenderIdentityKey = l.lenderAccount ?? l.lenderName;
    const displayName = ambiguousLenderNames.has(l.lenderName) ? `${l.lenderName} (${l.lenderAccount})` : l.lenderName;
    lenders.push({
      lenderIdentityKey,
      lenderName: displayName,
      ownershipPercent,
      brokerServicingFeeCents,
      isCurrent: Number(ownershipPercent) > 0.5,
    });
  }
  // Defensive: if the SAME identity key still appears twice on one contract
  // (a genuine duplicate row, distinct from the "shared display name, distinct
  // codes" case already handled above), merge them by summing ownership —
  // contract_parties has a unique (contract, party, role) constraint, so two
  // rows for the same lender would otherwise crash the write step.
  const dedupedLenders = new Map<string, MappedContract["lenders"][number]>();
  for (const l of lenders) {
    const existing = dedupedLenders.get(l.lenderIdentityKey);
    if (existing) {
      warnings.push(`Lender "${l.lenderName}" appears more than once on this contract — merged by summing ownership %`);
      existing.ownershipPercent = (Number(existing.ownershipPercent) + Number(l.ownershipPercent)).toFixed(3);
      existing.isCurrent = existing.isCurrent || l.isCurrent;
    } else {
      dedupedLenders.set(l.lenderIdentityKey, { ...l });
    }
  }
  lenders.length = 0;
  lenders.push(...dedupedLenders.values());

  if (lenders.length === 0) warnings.push("No lender assignment mapped — contract will be imported with no INVESTOR_PAYEE");

  let skipLenderPayouts = false;
  const currentLenders = lenders.filter((l) => l.isCurrent);
  if (lenders.length > 0 && currentLenders.length === 0) {
    // No lender shows nonzero % — every contract like this in the export has
    // a $0 principal balance (paid off), and most are single-lender where
    // TMO simply never got the field updated after payoff (100% is the only
    // sane value, matching every similar single-lender contract). With 2+
    // lenders all at 0%, there's no way to tell which was the final current
    // owner without more information — kept as a historical record, but
    // payout reconstruction is skipped rather than guessed at.
    if (lenders.length === 1) {
      warnings.push(
        `Lender "${lenders[0].lenderName}" showed 0% ownership (paid-off contract, field not updated) — auto-corrected to 100% since this is a single-lender contract`
      );
      lenders[0].ownershipPercent = "100.000";
      lenders[0].isCurrent = true;
    } else {
      skipLenderPayouts = true;
      warnings.push(
        `${lenders.length} lenders all show 0% ownership (transferred multiple times?) — can't identify the current owner, so lender payout reconstruction is skipped for this contract; all ${lenders.length} are still imported as a historical record`
      );
    }
  } else if (currentLenders.length > 0) {
    const currentSum = currentLenders.reduce((s, l) => s + Number(l.ownershipPercent), 0);
    if (Math.abs(currentSum - 100) > 0.5) {
      warnings.push(
        `Current (nonzero-%) lender(s) sum to ${currentSum.toFixed(3)}% (expected ~100%) — ${currentLenders.map((l) => l.lenderName).join(", ")}; imported as-is but worth a manual check`
      );
    }
  }

  const lastPrincipalBalance = [...acct.transactions].reverse().map((t) => moneyToCents(t.principalBalance)).find((v) => v !== null);
  const currentPrincipalBalanceCents = lastPrincipalBalance ?? moneyToCents(lt.principalBalance) ?? originalPrincipalCents;

  const scheduleRows = generateSchedule({
    principalCents: originalPrincipalCents,
    annualRatePercent: Number(interestRateAnnual),
    paymentAmountCents,
    amortizationTermMonths,
    numberOfPayments,
    firstPaymentDate,
  });
  const balloonAmountCents = hasBalloon ? scheduleRows[scheduleRows.length - 1]?.endingBalanceCents ?? null : null;

  return {
    accountNumber: acct.accountNumber,
    contractNumber: `TMO-${acct.accountNumber}`,
    buyers,
    property: { address: acct.property?.address ?? null, ...propCsz },
    originalPrincipalCents,
    currentPrincipalBalanceCents,
    interestRateAnnual,
    lienPriority: toLienPriority(lt.priority),
    amortizationTermMonths,
    numberOfPayments,
    hasBalloon,
    balloonAmountCents,
    balloonDueDate: hasBalloon ? maturityDate : null,
    paymentAmountCents,
    originationDate: originationDate!,
    firstPaymentDate,
    maturityDate,
    nextPaymentDate,
    paidOffDate: mdyToIso(lt.paidOffDate),
    status,
    lateFeeAmountCents: moneyToCents(lt.lateChargeAmount) ?? moneyToCents(lt.minimumLateFee),
    graceDays: lt.graceDays ? Number(lt.graceDays) : null,
    scheduleRows,
    payments,
    trustActivity,
    lenders,
    skipLenderPayouts,
    warnings,
  };
}

// --- CLI ---------------------------------------------------------------

const filePath = process.argv[2];
const mode = process.argv[3]; // "--dry-run" | "--write"
if (!filePath || (mode !== "--dry-run" && mode !== "--write")) {
  console.error("Usage: tsx scripts/import-tmo-data.ts <path-to-csv> --dry-run|--write");
  process.exit(1);
}

const accounts = parseFile(filePath);
const ambiguousLenderNames = findAmbiguousLenderNames(accounts);
const mapped = accounts.map((acct) => mapAccount(acct, ambiguousLenderNames));
const ok = mapped.filter((m): m is MappedContract => m !== null);
const skipped = accounts.length - ok.length;

console.log(`Parsed ${accounts.length} accounts, mapped ${ok.length}, skipped ${skipped}.`);
const totalPayments = ok.reduce((s, a) => s + a.payments.length, 0);
const totalAllocations = ok.reduce((s, a) => s + a.payments.reduce((s2, p) => s2 + p.allocations.length, 0), 0);
const totalTrust = ok.reduce((s, a) => s + a.trustActivity.length, 0);
const withWarnings = ok.filter((a) => a.warnings.length > 0);
console.log(`Total payments: ${totalPayments}, allocations: ${totalAllocations}, trust entries: ${totalTrust}`);
console.log(`Accounts with warnings: ${withWarnings.length}`);
withWarnings.slice(0, 30).forEach((a) => console.log(` - ${a.accountNumber}:`, a.warnings));

if (mode === "--dry-run") {
  console.log("\nSample mapped contract (first ok account):");
  const sample = { ...ok[0], payments: ok[0].payments.slice(0, 2), trustActivity: ok[0].trustActivity.slice(0, 2) };
  console.log(JSON.stringify(sample, null, 2));
  process.exit(0);
}

// --write mode below
config({ path: ".env.local" });

// Lender parties are shared across many contracts (44 distinct lenders fund
// 214 contracts) — cached across the whole run so each lender is created
// once, not once per contract. Populated lazily: checked in-memory first,
// then a DB lookup (in case of a resumed/partial run), then inserted.
const lenderPartyCache = new Map<string, string>();

async function run() {
  const { db } = await import("../src/db/client");
  const { eq, and } = await import("drizzle-orm");
  const { parties, properties } = await import("../src/db/schema/parties");
  const { contracts, contractParties } = await import("../src/db/schema/contracts");
  const { amortizationScheduleVersions, scheduledPayments } = await import("../src/db/schema/amortization");
  const { payments, paymentAllocations } = await import("../src/db/schema/payments");
  const { trustLedgerEntries } = await import("../src/db/schema/escrow");
  const { lenderLedgerEntries } = await import("../src/db/schema/lending");

  type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

  // Cached and looked up by identityKey (TMO's "Lender Account" code) — NOT
  // displayName, since a name like "ETC Custodian FBO" is shared by multiple
  // real, distinct investors. displayName is already disambiguated by the
  // time it gets here (see findAmbiguousLenderNames), so it's safe to use as
  // the DB lookup field — it's unique per identityKey — but the in-memory
  // cache keys on identityKey directly to make that invariant explicit.
  async function getOrCreateLenderPartyId(tx: Tx, identityKey: string, displayName: string): Promise<string> {
    const cached = lenderPartyCache.get(identityKey);
    if (cached) return cached;

    const existing = await tx
      .select({ id: parties.id })
      .from(parties)
      .where(and(eq(parties.displayName, displayName), eq(parties.partyType, "BUSINESS")))
      .limit(1);
    if (existing[0]) {
      lenderPartyCache.set(identityKey, existing[0].id);
      return existing[0].id;
    }

    const [inserted] = await tx.insert(parties).values({ partyType: "BUSINESS", displayName }).returning();
    lenderPartyCache.set(identityKey, inserted.id);
    return inserted.id;
  }

  let imported = 0;
  let skippedExisting = 0;
  let failed = 0;
  for (const acct of ok) {
    // Idempotent by contractNumber, so a rerun after a mid-run failure (or a
    // second pass with corrected logic) doesn't duplicate already-committed
    // accounts. Each account's DB work is one transaction — a failure rolls
    // back that account only and is logged, not fatal to the whole run.
    const [alreadyExists] = await db.select({ id: contracts.id }).from(contracts).where(eq(contracts.contractNumber, acct.contractNumber));
    if (alreadyExists) {
      skippedExisting++;
      continue;
    }

    try {
    await db.transaction(async (tx) => {
      const [property] = await tx
        .insert(properties)
        .values({
          streetAddress: acct.property.address ?? "UNKNOWN",
          city: acct.property.city ?? "UNKNOWN",
          state: acct.property.state ?? "MI",
          zip: acct.property.zip ?? "00000",
          county: "UNKNOWN",
        })
        .returning();

      const buyerParties = [];
      for (const b of acct.buyers) {
        const [party] = await tx
          .insert(parties)
          .values({ partyType: "INDIVIDUAL", displayName: b.name, taxIdLast4: b.ssnLast4 })
          .returning();
        buyerParties.push({ party, role: b.role });
      }

      const [contract] = await tx
        .insert(contracts)
        .values({
          contractNumber: acct.contractNumber,
          propertyId: property.id,
          purchasePriceCents: acct.originalPrincipalCents,
          downPaymentCents: 0,
          originalPrincipalCents: acct.originalPrincipalCents,
          currentPrincipalBalanceCents: acct.currentPrincipalBalanceCents,
          interestRateAnnual: acct.interestRateAnnual,
          lienPriority: acct.lienPriority,
          amortizationTermMonths: acct.amortizationTermMonths,
          paymentAmountCents: acct.paymentAmountCents,
          originationDate: acct.originationDate,
          firstPaymentDate: acct.firstPaymentDate,
          maturityDate: acct.maturityDate,
          nextPaymentDate: acct.nextPaymentDate,
          paidOffDate: acct.paidOffDate,
          hasBalloon: acct.hasBalloon,
          balloonAmountCents: acct.balloonAmountCents,
          balloonDueDate: acct.balloonDueDate,
          // Confirmed against live TMO data: all land-contract accounts in this
          // migration use a flat dollar late fee (never a percentage).
          lateFeeType: "FLAT",
          lateFeeAmountCents: acct.lateFeeAmountCents,
          lateFeeGraceDays: acct.graceDays,
          status: acct.status,
          statusChangedAt: acct.status === "PAID_OFF" ? new Date() : null,
        })
        .returning();

      if (buyerParties.length > 0) {
        await tx.insert(contractParties).values(
          buyerParties.map((b) => ({ contractId: contract.id, partyId: b.party.id, role: b.role }))
        );
      }

      // Every lender is linked as a ContractParty (including 0%-ownership
      // former owners, kept as a historical record of the transfer chain),
      // but only CURRENT (nonzero-%) owners feed into the payout ledger
      // computation below — and none do if skipLenderPayouts is set (no
      // reliable current owner could be identified for this contract).
      const lenderLinks: { lenderPartyId: string; ownershipPercent: number; brokerServicingFeeCents: number }[] = [];
      for (const l of acct.lenders) {
        const lenderPartyId = await getOrCreateLenderPartyId(tx, l.lenderIdentityKey, l.lenderName);
        await tx.insert(contractParties).values({
          contractId: contract.id,
          partyId: lenderPartyId,
          role: "INVESTOR_PAYEE",
          ownershipPercent: l.ownershipPercent,
          brokerServicingFeeCents: l.brokerServicingFeeCents,
        });
        if (l.isCurrent && !acct.skipLenderPayouts) {
          lenderLinks.push({
            lenderPartyId,
            ownershipPercent: Number(l.ownershipPercent),
            brokerServicingFeeCents: l.brokerServicingFeeCents,
          });
        }
      }

      // Reuse the schedule already generated in mapAccount() — it used the
      // correct (solved, not maturity-date-derived) term and balloon cutoff;
      // regenerating here with different inputs would silently diverge.
      const schedule = acct.scheduleRows;

      const [scheduleVersion] = await tx
        .insert(amortizationScheduleVersions)
        .values({
          contractId: contract.id,
          versionNumber: 1,
          effectiveDate: acct.originationDate,
          reason: "TMO_IMPORT",
          principalBalanceAtStartCents: acct.originalPrincipalCents,
          interestRateAnnual: acct.interestRateAnnual,
          amortizationTermMonths: acct.amortizationTermMonths,
          numberOfPayments: schedule.length,
          paymentAmountCents: acct.paymentAmountCents,
        })
        .returning();

      await insertInChunks(tx, scheduledPayments, schedule.map((row) => ({
        scheduleVersionId: scheduleVersion.id,
        periodNumber: row.periodNumber,
        dueDate: row.dueDate,
        beginningBalanceCents: row.beginningBalanceCents,
        scheduledInterestCents: row.scheduledInterestCents,
        scheduledPrincipalCents: row.scheduledPrincipalCents,
        scheduledTotalCents: row.scheduledTotalCents,
        endingBalanceCents: row.endingBalanceCents,
      })));

      // Reconstructed lender payouts: the CSV export has no historical
      // lender-side ledger (that lives only in TMO's separate "All Lenders"
      // module), so we compute what each lender's credit *should have been*
      // for every historical payment — P&I only, per lender's ownership %,
      // minus their flat broker fee (confirmed against real TMO ledger data).
      // These are marked as computed, not imported, in the description.
      const lenderLedgerRows: {
        lenderPartyId: string;
        sourceContractId: string;
        transactionDate: string;
        reference: string | null;
        description: string;
        amountReceivedCents: number;
      }[] = [];

      for (const p of acct.payments) {
        const [payment] = await tx
          .insert(payments)
          .values({
            contractId: contract.id,
            receivedDate: p.date,
            amountCents: p.amountCents,
            paymentMethod: "LEGACY_IMPORT",
            referenceNumber: p.reference,
            status: "CLEARED",
            legacyDescription: p.description,
          })
          .returning();
        if (p.allocations.length > 0) {
          await tx.insert(paymentAllocations).values(
            p.allocations.map((a) => ({ paymentId: payment.id, allocationType: a.type, amountCents: a.amountCents }))
          );
        }

        const piPortionCents = p.allocations
          .filter((a) => a.type === "PRINCIPAL" || a.type === "INTEREST")
          .reduce((sum, a) => sum + a.amountCents, 0);
        if (piPortionCents !== 0) {
          for (const lender of lenderLinks) {
            const netCents = calculateLenderShare({
              paymentAmountCents: piPortionCents,
              ownershipPercent: lender.ownershipPercent,
              brokerServicingFeeCents: lender.brokerServicingFeeCents,
            });
            lenderLedgerRows.push({
              lenderPartyId: lender.lenderPartyId,
              sourceContractId: contract.id,
              transactionDate: p.date,
              reference: p.reference,
              description: `Computed from imported payment (${p.description ?? "Payment"})`,
              amountReceivedCents: netCents,
            });
          }
        }
      }

      if (lenderLedgerRows.length > 0) {
        await insertInChunks(tx, lenderLedgerEntries, lenderLedgerRows);
      }

      if (acct.trustActivity.length > 0) {
        await insertInChunks(tx, trustLedgerEntries, acct.trustActivity.map((t) => ({
          contractId: contract.id,
          transactionDate: t.date,
          reference: t.reference,
          payeeOrPayerName: t.payeeOrPayer,
          description: t.description,
          amountPaidOutCents: t.amountPaidOutCents,
          amountReceivedCents: t.amountReceivedCents,
          balanceCents: t.balanceCents,
        })));
      }
    });
    imported++;
    if (imported % 25 === 0) console.log(`Imported ${imported}/${ok.length} accounts...`);
    } catch (err) {
      failed++;
      console.error(`FAILED to import account ${acct.accountNumber} (${acct.contractNumber}):`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`Done. Imported ${imported}, skipped (already existed) ${skippedExisting}, failed ${failed}.`);
  process.exit(0);
}

interface Insertable {
  insert(table: unknown): { values(rows: unknown[]): Promise<unknown> };
}

async function insertInChunks<T extends Record<string, unknown>>(tx: Insertable, table: unknown, rows: T[], chunkSize = 500) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    await tx.insert(table).values(rows.slice(i, i + chunkSize));
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
