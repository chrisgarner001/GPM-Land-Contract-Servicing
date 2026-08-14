import { eq, and, sum, asc, gt, desc, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts } from "@/db/schema/contracts";
import { payments, paymentAllocations, paymentMethodEnum } from "@/db/schema/payments";
import { contractCharges } from "@/db/schema/charges";
import { trustLedgerEntries } from "@/db/schema/escrow";
import { applyPayment } from "@/domain/ledger/applyPayment";
import { advanceNextPaymentDate, regressNextPaymentDate } from "@/domain/ledger/advanceNextPaymentDate";
import { computeReleaseDate } from "@/domain/ledger/computeReleaseDate";
import { daysPastDue } from "@/domain/ledger/calculateAmountDue";
import { creditActiveLenders, creditLendersForPayment, reverseLenderCreditsForPayment } from "./lenderLedger";

export interface RecordPaymentInput {
  contractId: string;
  receivedDate: string;
  amountCents: number;
  paymentMethod: (typeof paymentMethodEnum.enumValues)[number];
  referenceNumber: string | null;
  escrowPortionCents?: number;
  lateFeeCents?: number;
  // Applied toward the contract's outstanding contract_charges balance (see
  // charges.ts / New Invoice's "Charge Lender" mode) — FIFO by oldest charge,
  // and credits the same amount back to whichever lender(s) were originally
  // debited when the charge was posted.
  chargePaymentCents?: number;
  // Reserve only combines with this deposit when explicitly requested — a
  // pre-existing balance never silently folds into a payment on its own.
  applyReserve?: boolean;
  actorEmail: string | null;
  // Set only by the Helcim webhook handler: updates this already-existing
  // PENDING row (created when the borrower portal payment was submitted)
  // in place instead of inserting a new one, once settlement is confirmed.
  // Safe under the ledger's append-only rule — this only ever mutates a row
  // that has never been CLEARED yet.
  existingPaymentId?: string;
}

export interface RecordPaymentResult {
  heldInReserve: boolean;
}

async function getReserveBalanceCents(contractId: string): Promise<number> {
  const [row] = await db
    .select({ total: sum(paymentAllocations.amountCents) })
    .from(paymentAllocations)
    .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
    .where(and(eq(payments.contractId, contractId), eq(paymentAllocations.allocationType, "SUSPENSE")));
  return Number(row?.total ?? 0);
}

export async function getUnpaidChargesCents(contractId: string): Promise<number> {
  const [row] = await db
    .select({ total: sum(contractCharges.remainingCents) })
    .from(contractCharges)
    .where(and(eq(contractCharges.contractId, contractId), gt(contractCharges.remainingCents, 0)));
  return Number(row?.total ?? 0);
}

// The standing escrow portion a borrower pays each period — what "Run Escrow
// Analysis" treats as the current monthly payment. Read from the most recent
// CLEARED payment's own allocation rather than hardcoded, so it stays in sync
// with whatever the last actual analysis/adjustment set it to. Shared by the
// contract page and the borrower portal's Make Payment breakdown.
export async function getCurrentEscrowPortionCents(contractId: string): Promise<number> {
  // An explicit staff-set monthlyEscrowPaymentCents always wins — see the
  // schema comment on contracts.monthlyEscrowPaymentCents. Only when it's
  // never been set do we fall back to the original heuristic (infer from
  // the last cleared payment's own escrow allocation), so contracts that
  // have never touched this field behave exactly as before.
  const [contract] = await db.select({ monthlyEscrowPaymentCents: contracts.monthlyEscrowPaymentCents }).from(contracts).where(eq(contracts.id, contractId));
  if (contract?.monthlyEscrowPaymentCents !== null && contract?.monthlyEscrowPaymentCents !== undefined) {
    return contract.monthlyEscrowPaymentCents;
  }

  const [latestEscrowPayment] = await db
    .select({ amountCents: paymentAllocations.amountCents })
    .from(paymentAllocations)
    .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
    .where(
      and(
        eq(payments.contractId, contractId),
        eq(paymentAllocations.allocationType, "ESCROW_TAX"),
        eq(payments.status, "CLEARED"),
        isNull(payments.reversedPaymentId)
      )
    )
    .orderBy(desc(payments.receivedDate), desc(payments.createdAt))
    .limit(1);
  return latestEscrowPayment?.amountCents ?? 0;
}

export interface EscrowAndReserveBalances {
  escrowBalanceCents: number | null;
  reserveBalanceCents: number;
}

// escrowBalanceCents is TMO's own authoritative running Trust Account
// balance (see trust_ledger_entries' schema comment) — not reconstructed,
// since historical per-payment escrow collection data is known incomplete.
// reserveBalanceCents is the SUSPENSE allocation total we fully control
// (positive when a partial payment is held, negative when drawn down into a
// full payment). Shared by the contract page and the Borrower Statement of
// Account report.
export async function getEscrowAndReserveBalances(contractId: string): Promise<EscrowAndReserveBalances> {
  const [[reserveRow], [latestTrustEntry]] = await Promise.all([
    db
      .select({ total: sum(paymentAllocations.amountCents) })
      .from(paymentAllocations)
      .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
      .where(and(eq(payments.contractId, contractId), eq(paymentAllocations.allocationType, "SUSPENSE"))),
    // id is a tiebreaker only, not a meaningful sequence — trust_ledger_entries
    // has no real ordering column for same-day rows, but ties still need to
    // resolve the same way everywhere this value is read (Escrow Analysis,
    // Escrow Maintenance, and the contract page use the identical tiebreaker).
    db
      .select({ balanceCents: trustLedgerEntries.balanceCents })
      .from(trustLedgerEntries)
      .where(eq(trustLedgerEntries.contractId, contractId))
      .orderBy(desc(trustLedgerEntries.transactionDate), desc(trustLedgerEntries.id))
      .limit(1),
  ]);

  return {
    escrowBalanceCents: latestTrustEntry?.balanceCents ?? null,
    reserveBalanceCents: Number(reserveRow?.total ?? 0),
  };
}

// Shared by the per-contract Make Payment form and the Bulk Payment (check
// scan) flow — both need identical allocation/balance/payoff logic, just
// different entry points for gathering the input fields.
export async function recordPayment(input: RecordPaymentInput): Promise<RecordPaymentResult> {
  const { contractId, receivedDate, amountCents, paymentMethod, referenceNumber, actorEmail } = input;
  const escrowPortionCents = input.escrowPortionCents ?? 0;

  const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!contract) throw new Error("Contract not found.");

  const existingReserveBalanceCents = input.applyReserve ? await getReserveBalanceCents(contractId) : 0;

  const result = applyPayment({
    paymentAmountCents: amountCents,
    currentPrincipalBalanceCents: contract.currentPrincipalBalanceCents,
    annualRatePercent: Number(contract.interestRateAnnual),
    regularPaymentAmountCents: contract.paymentAmountCents,
    existingReserveBalanceCents,
    escrowPortionCents,
    lateFeeCents: input.lateFeeCents,
    chargePaymentCents: input.chargePaymentCents,
  });

  await db.transaction(async (tx) => {
    const values = {
      contractId,
      receivedDate,
      amountCents,
      paymentMethod,
      referenceNumber,
      status: "CLEARED" as const,
      legacyDescription: result.heldInReserve ? "Partial Payment (Held in Reserve)" : "Payment",
      createdBy: actorEmail,
      releaseDate: computeReleaseDate(receivedDate),
    };

    const [payment] = input.existingPaymentId
      ? await tx.update(payments).set(values).where(eq(payments.id, input.existingPaymentId)).returning()
      : await tx.insert(payments).values(values).returning();

    await tx.insert(paymentAllocations).values(
      result.allocations.map((a) => ({ paymentId: payment.id, allocationType: a.type, amountCents: a.amountCents }))
    );

    // Credits this contract's active lender(s) their share of this payment
    // — principal + interest + late fee (late fees are lender revenue, not
    // SGMS's), minus the flat servicing fee — see Lender Payment Runs.
    // Silently produces no credit if the contract currently has no active
    // lender; a funding gap must never block recording a normal payment.
    const interestCentsThisPayment = result.allocations
      .filter((a) => a.type === "INTEREST")
      .reduce((s, a) => s + a.amountCents, 0);
    const principalCentsThisPayment = result.allocations
      .filter((a) => a.type === "PRINCIPAL")
      .reduce((s, a) => s + a.amountCents, 0);
    const lateFeeCentsThisPayment = result.allocations
      .filter((a) => a.type === "LATE_FEE")
      .reduce((s, a) => s + a.amountCents, 0);
    await creditLendersForPayment(tx, {
      contractId,
      paymentId: payment.id,
      transactionDate: receivedDate,
      interestCents: interestCentsThisPayment,
      principalCents: principalCentsThisPayment,
      lateFeeCents: lateFeeCentsThisPayment,
    });

    const chargeAppliedCents = result.allocations
      .filter((a) => a.type === "OTHER_FEE")
      .reduce((s, a) => s + a.amountCents, 0);
    if (chargeAppliedCents > 0) {
      const outstandingCharges = await tx
        .select({ id: contractCharges.id, remainingCents: contractCharges.remainingCents })
        .from(contractCharges)
        .where(and(eq(contractCharges.contractId, contractId), gt(contractCharges.remainingCents, 0)))
        .orderBy(asc(contractCharges.chargeDate));

      let remainingToApply = chargeAppliedCents;
      for (const charge of outstandingCharges) {
        if (remainingToApply <= 0) break;
        const appliedToThisCharge = Math.min(remainingToApply, charge.remainingCents);
        await tx
          .update(contractCharges)
          .set({ remainingCents: charge.remainingCents - appliedToThisCharge })
          .where(eq(contractCharges.id, charge.id));
        remainingToApply -= appliedToThisCharge;
      }

      await creditActiveLenders(tx, contractId, chargeAppliedCents, receivedDate, `Charge repayment — ${contract.contractNumber}`);
    }

    const paidOff = result.newPrincipalBalanceCents <= 0 && contract.status === "ACTIVE";
    await tx
      .update(contracts)
      .set({
        currentPrincipalBalanceCents: result.newPrincipalBalanceCents,
        // A held-in-reserve deposit hasn't satisfied a period yet, so the due
        // date only advances once a payment actually clears in full.
        ...(!result.heldInReserve && contract.nextPaymentDate
          ? { nextPaymentDate: advanceNextPaymentDate(contract.nextPaymentDate, contract.paymentFrequency) }
          : {}),
        ...(paidOff ? { status: "PAID_OFF", statusChangedAt: new Date(), paidOffDate: receivedDate } : {}),
      })
      .where(eq(contracts.id, contractId));
  });

  return { heldInReserve: result.heldInReserve };
}

export interface PrincipalPaydownEligibility {
  eligible: boolean;
  reason: string | null;
}

// Principal Paydown is an extra, principal-only payment — it's only allowed
// when the account is fully current: the regular scheduled payment isn't
// past due (so no interest/escrow tied to a missed payment is outstanding)
// and there are no unpaid contract_charges ("other charges"). Shared by the
// contract page (to show/hide the option and explain why) and
// recordPrincipalPaydown itself (which must never trust a client-side-only
// check for something that moves money).
export async function checkPrincipalPaydownEligibility(contractId: string): Promise<PrincipalPaydownEligibility> {
  const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!contract) return { eligible: false, reason: "Contract not found." };

  if (daysPastDue(contract.nextPaymentDate) > 0) {
    return {
      eligible: false,
      reason: "This contract's regular payment is past due — settle it before making a principal-only paydown.",
    };
  }
  const unpaidChargesCents = await getUnpaidChargesCents(contractId);
  if (unpaidChargesCents > 0) {
    return {
      eligible: false,
      reason: "This contract has unpaid charges — settle them before making a principal-only paydown.",
    };
  }
  return { eligible: true, reason: null };
}

export interface RecordPrincipalPaydownInput {
  contractId: string;
  receivedDate: string;
  amountCents: number;
  paymentMethod: (typeof paymentMethodEnum.enumValues)[number];
  referenceNumber: string | null;
  actorEmail: string | null;
  // Set only by the Helcim webhook handler: updates this already-existing
  // PENDING row (created when the borrower portal paydown was submitted) in
  // place instead of inserting a new one — same as recordPayment's.
  existingPaymentId?: string;
}

// A principal-only payment: no interest/escrow/late-fee/reserve math at
// all, unlike recordPayment — the full amount goes to PRINCIPAL, and
// nextPaymentDate is deliberately left untouched (this is an extra
// curtailment, not a replacement for the next regular payment).
export async function recordPrincipalPaydown(input: RecordPrincipalPaydownInput): Promise<void> {
  const { contractId, receivedDate, amountCents, paymentMethod, referenceNumber, actorEmail } = input;
  if (amountCents <= 0) throw new Error("Enter an amount greater than zero.");

  const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!contract) throw new Error("Contract not found.");

  const eligibility = await checkPrincipalPaydownEligibility(contractId);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason ?? "Principal Paydown is not allowed on this contract right now.");
  }
  if (amountCents > contract.currentPrincipalBalanceCents) {
    throw new Error("Amount exceeds the outstanding principal balance.");
  }

  const newPrincipalBalanceCents = contract.currentPrincipalBalanceCents - amountCents;
  const paidOff = newPrincipalBalanceCents <= 0 && contract.status === "ACTIVE";

  await db.transaction(async (tx) => {
    const values = {
      contractId,
      receivedDate,
      amountCents,
      paymentMethod,
      referenceNumber,
      status: "CLEARED" as const,
      legacyDescription: "Principal Paydown",
      createdBy: actorEmail,
      releaseDate: computeReleaseDate(receivedDate),
    };

    const [payment] = input.existingPaymentId
      ? await tx.update(payments).set(values).where(eq(payments.id, input.existingPaymentId)).returning()
      : await tx.insert(payments).values(values).returning();

    await tx.insert(paymentAllocations).values({ paymentId: payment.id, allocationType: "PRINCIPAL", amountCents });

    await creditLendersForPayment(tx, {
      contractId,
      paymentId: payment.id,
      transactionDate: receivedDate,
      interestCents: 0,
      principalCents: amountCents,
    });

    await tx
      .update(contracts)
      .set({
        currentPrincipalBalanceCents: newPrincipalBalanceCents,
        ...(paidOff ? { status: "PAID_OFF", statusChangedAt: new Date(), paidOffDate: receivedDate } : {}),
      })
      .where(eq(contracts.id, contractId));
  });
}

// A correction never mutates or deletes a CLEARED payment — it marks the
// original REVERSED and inserts an offsetting payment (negative amount,
// negated allocations) referencing it, per the ledger's append-only design
// (see payments.ts schema comment). Restricted to the most recent original
// (non-reversal) payment on the contract: reversing an older one while later
// payments already assumed its effect on the balance would silently corrupt
// those later payments' interest/principal math.
export async function reversePayment(paymentId: string, actorEmail: string | null): Promise<void> {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId));
  if (!payment) throw new Error("Payment not found.");
  if (payment.status === "REVERSED") throw new Error("This payment has already been reversed.");
  if (payment.reversedPaymentId !== null || payment.legacyDescription?.startsWith("Reversal of")) {
    throw new Error("A reversal entry cannot itself be reversed.");
  }

  const [mostRecent] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.contractId, payment.contractId), eq(payments.status, "CLEARED"), isNull(payments.reversedPaymentId)))
    .orderBy(desc(payments.receivedDate), desc(payments.createdAt))
    .limit(1);
  if (mostRecent?.id !== paymentId) {
    throw new Error("Only the most recent payment can be reversed — contact an administrator for older corrections.");
  }

  const allocations = await db.select().from(paymentAllocations).where(eq(paymentAllocations.paymentId, paymentId));
  const [contract] = await db.select().from(contracts).where(eq(contracts.id, payment.contractId));
  if (!contract) throw new Error("Contract not found.");

  const principalReversalCents = -allocations
    .filter((a) => a.allocationType === "PRINCIPAL")
    .reduce((s, a) => s + a.amountCents, 0);
  const newPrincipalBalanceCents = contract.currentPrincipalBalanceCents - principalReversalCents;
  const wasPaidOffByThis = contract.status === "PAID_OFF" && newPrincipalBalanceCents > 0;
  const wasHeldInReserve = payment.legacyDescription === "Partial Payment (Held in Reserve)";

  const reversalDate = new Date().toISOString().slice(0, 10);

  await db.transaction(async (tx) => {
    await tx.update(payments).set({ status: "REVERSED" }).where(eq(payments.id, paymentId));

    const [reversal] = await tx
      .insert(payments)
      .values({
        contractId: payment.contractId,
        receivedDate: reversalDate,
        amountCents: -payment.amountCents,
        paymentMethod: "ADJUSTMENT",
        referenceNumber: payment.referenceNumber,
        status: "CLEARED",
        reversedPaymentId: payment.id,
        legacyDescription: `Reversal of payment on ${payment.receivedDate}`,
        createdBy: actorEmail,
      })
      .returning();

    if (allocations.length > 0) {
      await tx.insert(paymentAllocations).values(
        allocations.map((a) => ({ paymentId: reversal.id, allocationType: a.allocationType, amountCents: -a.amountCents }))
      );
    }

    await reverseLenderCreditsForPayment(tx, paymentId, reversalDate);

    await tx
      .update(contracts)
      .set({
        currentPrincipalBalanceCents: newPrincipalBalanceCents,
        ...(!wasHeldInReserve && contract.nextPaymentDate
          ? { nextPaymentDate: regressNextPaymentDate(contract.nextPaymentDate, contract.paymentFrequency) }
          : {}),
        ...(wasPaidOffByThis ? { status: "ACTIVE", statusChangedAt: new Date(), paidOffDate: null } : {}),
      })
      .where(eq(contracts.id, payment.contractId));
  });
}
