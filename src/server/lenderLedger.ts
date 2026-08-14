import Decimal from "decimal.js";
import { eq, and, gt, isNull, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { contractParties } from "@/db/schema/contracts";
import { lenderLedgerEntries } from "@/db/schema/lending";
import { calculateLenderShare } from "@/domain/lending/calculateLenderShare";

// Extracted rather than hand-typed against drizzle's PgTransaction generics
// (which vary by driver) — guaranteed to match whatever `db.transaction`
// actually infers for this project's postgres-js setup.
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Same "current lender" filter used everywhere else in the app (Lenders
// list, Lender Portal, Funding page): ownershipPercent > 0 AND not yet
// superseded by a later funding (endDate IS NULL).
export interface ActiveLender {
  partyId: string;
  ownershipPercent: number;
  brokerServicingFeeCents: number;
}

export async function getActiveLenders(contractId: string): Promise<ActiveLender[]> {
  const rows = await db
    .select({
      partyId: contractParties.partyId,
      ownershipPercent: contractParties.ownershipPercent,
      brokerServicingFeeCents: contractParties.brokerServicingFeeCents,
    })
    .from(contractParties)
    .where(
      and(
        eq(contractParties.contractId, contractId),
        eq(contractParties.role, "INVESTOR_PAYEE"),
        gt(contractParties.ownershipPercent, "0"),
        isNull(contractParties.endDate)
      )
    );
  return rows.map((r) => ({
    partyId: r.partyId,
    ownershipPercent: Number(r.ownershipPercent),
    brokerServicingFeeCents: r.brokerServicingFeeCents ?? 0,
  }));
}

// id is a tiebreaker only — lender_ledger_entries has no reliable ordering
// column for same-date rows (same ambiguity as trust_ledger_entries; see
// Escrow Maintenance page comment), but ties still need to resolve the same
// way everywhere this value is read.
// Takes the caller's own executor (db, or a transaction's tx) rather than
// always querying via the module-level db — every call site here runs
// inside a db.transaction() callback, and querying via a second, separate
// connection (db) while that transaction holds its own connection open
// races the connection pool (Supabase's pooler included) and can't see the
// transaction's own uncommitted inserts anyway, so multi-lender splits would
// silently read a stale prior balance for every lender after the first.
export async function getLatestLenderBalanceCents(executor: Tx | typeof db, lenderPartyId: string): Promise<number> {
  const [row] = await executor
    .select({ balanceCents: lenderLedgerEntries.balanceCents })
    .from(lenderLedgerEntries)
    .where(eq(lenderLedgerEntries.lenderPartyId, lenderPartyId))
    .orderBy(desc(lenderLedgerEntries.transactionDate), desc(lenderLedgerEntries.id))
    .limit(1);
  return row?.balanceCents ?? 0;
}

function splitProportionally(totalCents: number, lenders: ActiveLender[]): { partyId: string; shareCents: number }[] {
  return lenders.map((l) => ({
    partyId: l.partyId,
    shareCents: new Decimal(totalCents)
      .mul(l.ownershipPercent)
      .dividedBy(100)
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      .toNumber(),
  }));
}

// Debits the contract's currently active lender(s) — proportional to
// ownership, no servicing fee deducted (this is a one-off advance being
// fronted on the lender's behalf, not a regular loan-payment distribution;
// see domain/lending/calculateLenderShare.ts for the fee-bearing case) — for
// a vendor invoice posted via New Invoice's "Charge Lender" mode. Must run
// inside the same transaction as the invoice's other writes.
export async function debitActiveLenders(
  tx: Tx,
  contractId: string,
  amountCents: number,
  transactionDate: string,
  description: string
): Promise<void> {
  const lenders = await getActiveLenders(contractId);
  if (lenders.length === 0) {
    throw new Error("No active lender is currently funding this contract — cannot use Charge Lender.");
  }

  const shares = splitProportionally(amountCents, lenders);
  for (const { partyId, shareCents } of shares) {
    if (shareCents <= 0) continue;
    const priorBalanceCents = await getLatestLenderBalanceCents(tx, partyId);
    await tx.insert(lenderLedgerEntries).values({
      lenderPartyId: partyId,
      sourceContractId: contractId,
      transactionDate,
      description,
      amountPaidOutCents: shareCents,
      balanceCents: priorBalanceCents - shareCents,
      entryType: "CHARGE_DEBIT",
    });
  }
}

// Credits the contract's currently active lender(s) back — proportional to
// ownership — when a borrower repays an outstanding charge (see
// contract_charges / server/payments.ts "Pay Charges"). Must run inside the
// same transaction as the payment's other writes.
export async function creditActiveLenders(
  tx: Tx,
  contractId: string,
  amountCents: number,
  transactionDate: string,
  description: string
): Promise<void> {
  const lenders = await getActiveLenders(contractId);
  if (lenders.length === 0) return;

  const shares = splitProportionally(amountCents, lenders);
  for (const { partyId, shareCents } of shares) {
    if (shareCents <= 0) continue;
    const priorBalanceCents = await getLatestLenderBalanceCents(tx, partyId);
    await tx.insert(lenderLedgerEntries).values({
      lenderPartyId: partyId,
      sourceContractId: contractId,
      transactionDate,
      description,
      amountReceivedCents: shareCents,
      balanceCents: priorBalanceCents + shareCents,
      entryType: "CHARGE_CREDIT",
    });
  }
}

// Credits each active lender their share of a REGULAR borrower payment —
// principal + interest + any late fee (late fees are lender revenue, not
// SGMS's — confirmed against real usage; escrow/OTHER_FEE are NOT included,
// those aren't lender-owned capital) — minus their flat broker servicing
// fee, deducted once from the combined total. The breakdown is stored on
// the row itself (not recomputed later) since ownershipPercent/
// brokerServicingFeeCents can both change via contractParties funding
// history after this payment was recorded. See
// domain/lending/calculateLenderShare.ts for the underlying math; a lender
// whose net share isn't positive (fee exceeds their share) gets no row, same
// as creditActiveLenders/debitActiveLenders already do for non-positive
// shares.
export async function creditLendersForPayment(
  tx: Tx,
  params: { contractId: string; paymentId: string; transactionDate: string; interestCents: number; principalCents: number; lateFeeCents?: number }
): Promise<void> {
  const { contractId, paymentId, transactionDate, interestCents, principalCents, lateFeeCents = 0 } = params;
  const lenders = await getActiveLenders(contractId);
  if (lenders.length === 0) return;

  for (const { partyId, ownershipPercent, brokerServicingFeeCents } of lenders) {
    const netCents = calculateLenderShare({
      paymentAmountCents: interestCents + principalCents + lateFeeCents,
      ownershipPercent,
      brokerServicingFeeCents,
    });
    if (netCents <= 0) continue;

    const interestShareCents = calculateLenderShare({ paymentAmountCents: interestCents, ownershipPercent, brokerServicingFeeCents: 0 });
    const principalShareCents = calculateLenderShare({ paymentAmountCents: principalCents, ownershipPercent, brokerServicingFeeCents: 0 });
    const lateFeeShareCents = calculateLenderShare({ paymentAmountCents: lateFeeCents, ownershipPercent, brokerServicingFeeCents: 0 });
    const priorBalanceCents = await getLatestLenderBalanceCents(tx, partyId);

    await tx.insert(lenderLedgerEntries).values({
      lenderPartyId: partyId,
      sourceContractId: contractId,
      sourcePaymentId: paymentId,
      transactionDate,
      amountReceivedCents: netCents,
      interestCents: interestShareCents,
      principalCents: principalShareCents,
      lateFeeCents: lateFeeShareCents,
      servicingFeeCents: brokerServicingFeeCents,
      balanceCents: priorBalanceCents + netCents,
      entryType: "PAYMENT_CREDIT",
    });
  }
}

// Symmetric with reversePayment's negated-allocations pattern: finds every
// PAYMENT_CREDIT row this specific payment produced and inserts an
// offsetting row for each, rather than deleting/mutating the original
// (append-only ledger, same rule as payments/paymentAllocations).
export async function reverseLenderCreditsForPayment(tx: Tx, originalPaymentId: string, reversalDate: string): Promise<void> {
  const credits = await tx
    .select()
    .from(lenderLedgerEntries)
    .where(and(eq(lenderLedgerEntries.sourcePaymentId, originalPaymentId), eq(lenderLedgerEntries.entryType, "PAYMENT_CREDIT")));

  for (const credit of credits) {
    const priorBalanceCents = await getLatestLenderBalanceCents(tx, credit.lenderPartyId);
    const amountReceivedCents = -(credit.amountReceivedCents ?? 0);
    await tx.insert(lenderLedgerEntries).values({
      lenderPartyId: credit.lenderPartyId,
      sourceContractId: credit.sourceContractId,
      sourcePaymentId: credit.sourcePaymentId,
      transactionDate: reversalDate,
      amountReceivedCents,
      interestCents: credit.interestCents === null ? null : -credit.interestCents,
      principalCents: credit.principalCents === null ? null : -credit.principalCents,
      lateFeeCents: credit.lateFeeCents === null ? null : -credit.lateFeeCents,
      servicingFeeCents: credit.servicingFeeCents === null ? null : -credit.servicingFeeCents,
      balanceCents: priorBalanceCents + amountReceivedCents,
      entryType: "PAYMENT_CREDIT",
    });
  }
}
