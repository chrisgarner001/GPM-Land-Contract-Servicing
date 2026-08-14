import Decimal from "decimal.js";
import { annualRateToMonthlyDecimal } from "../money";

export interface ApplyPaymentInput {
  paymentAmountCents: number;
  currentPrincipalBalanceCents: number;
  annualRatePercent: number;
  // The contract's regular scheduled payment. A deposit that, combined with
  // any already-held reserve, still falls short of this amount is held in
  // full rather than applied — per the business rule that partial payments
  // are not enough to satisfy a payment and must accumulate first.
  regularPaymentAmountCents: number;
  // Currently held, un-applied balance from prior partial payments.
  existingReserveBalanceCents: number;
  // Applied first (after any reserve draw-down), before interest/principal.
  escrowPortionCents?: number;
  // The late fee currently due (already computed by
  // domain/ledger/calculateAmountDue.ts, the same figure shown to staff as
  // part of "Payment Due Amount") — applied after escrow, before interest,
  // and counted toward whether this deposit satisfies a full payment.
  lateFeeCents?: number;
  // A discretionary amount the borrower is including on top of their regular
  // payment, applied toward their outstanding contract_charges balance (see
  // server/payments.ts). Applied after the late fee, before interest — and,
  // unlike the late fee, NOT counted toward whether this deposit satisfies a
  // full payment, since it's an optional extra rather than a required
  // minimum. Uses the OTHER_FEE allocation type — the same one TMO's own
  // historical "Charges" data was imported under (see
  // scripts/import-tmo-data.ts), so it displays identically to existing
  // charge history without any new type needing to be threaded through.
  chargePaymentCents?: number;
}

export interface PaymentAllocationResult {
  type: "ESCROW_TAX" | "LATE_FEE" | "OTHER_FEE" | "INTEREST" | "PRINCIPAL" | "SUSPENSE";
  amountCents: number;
}

export interface ApplyPaymentResult {
  allocations: PaymentAllocationResult[];
  newPrincipalBalanceCents: number;
  // True when the entire deposit was held in reserve (no interest/principal applied).
  heldInReserve: boolean;
}

export function applyPayment(input: ApplyPaymentInput): ApplyPaymentResult {
  const {
    paymentAmountCents,
    currentPrincipalBalanceCents,
    annualRatePercent,
    regularPaymentAmountCents,
    existingReserveBalanceCents,
  } = input;

  const lateFeeCents = Math.max(0, input.lateFeeCents ?? 0);
  const combinedAvailableCents = existingReserveBalanceCents + paymentAmountCents;

  if (combinedAvailableCents < regularPaymentAmountCents + lateFeeCents) {
    return {
      allocations: [{ type: "SUSPENSE", amountCents: paymentAmountCents }],
      newPrincipalBalanceCents: currentPrincipalBalanceCents,
      heldInReserve: true,
    };
  }

  const escrowPortionCents = Math.max(0, Math.min(input.escrowPortionCents ?? 0, combinedAvailableCents));
  const allocations: PaymentAllocationResult[] = [];

  // Enough for a full payment now — draw the held reserve back to zero and
  // apply the combined amount (reserve + this deposit) as one payment.
  if (existingReserveBalanceCents > 0) {
    allocations.push({ type: "SUSPENSE", amountCents: -existingReserveBalanceCents });
  }

  let remainingCents = combinedAvailableCents - escrowPortionCents;
  if (escrowPortionCents > 0) allocations.push({ type: "ESCROW_TAX", amountCents: escrowPortionCents });

  const lateFeeAppliedCents = Math.max(0, Math.min(remainingCents, lateFeeCents));
  remainingCents -= lateFeeAppliedCents;
  if (lateFeeAppliedCents > 0) allocations.push({ type: "LATE_FEE", amountCents: lateFeeAppliedCents });

  const chargePaymentCents = Math.max(0, input.chargePaymentCents ?? 0);
  const chargeAppliedCents = Math.max(0, Math.min(remainingCents, chargePaymentCents));
  remainingCents -= chargeAppliedCents;
  if (chargeAppliedCents > 0) allocations.push({ type: "OTHER_FEE", amountCents: chargeAppliedCents });

  const monthlyInterestDueCents = new Decimal(currentPrincipalBalanceCents)
    .mul(annualRateToMonthlyDecimal(annualRatePercent))
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();

  const interestAppliedCents = Math.max(0, Math.min(remainingCents, monthlyInterestDueCents));
  remainingCents -= interestAppliedCents;
  if (interestAppliedCents > 0) allocations.push({ type: "INTEREST", amountCents: interestAppliedCents });

  const principalAppliedCents = Math.max(0, Math.min(remainingCents, currentPrincipalBalanceCents));
  remainingCents -= principalAppliedCents;
  if (principalAppliedCents > 0) allocations.push({ type: "PRINCIPAL", amountCents: principalAppliedCents });

  // Payment exceeds full payoff — hold the excess rather than go negative.
  if (remainingCents > 0) allocations.push({ type: "SUSPENSE", amountCents: remainingCents });

  return {
    allocations,
    newPrincipalBalanceCents: currentPrincipalBalanceCents - principalAppliedCents,
    heldInReserve: false,
  };
}
