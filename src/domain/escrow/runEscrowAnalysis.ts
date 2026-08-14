import Decimal from "decimal.js";

export interface EscrowAnalysisInput {
  currentEscrowBalanceCents: number;
  currentMonthlyEscrowPaymentCents: number;
  projectedAnnualTaxCents: number;
  projectedAnnualInsuranceCents: number;
  /** Confirmed business rule (superseding the old flat-5%-of-projected-
   *  disbursements policy): a flat 2-month-of-payment buffer, closer to
   *  RESPA's 1/6 cushion convention even though land contracts aren't
   *  actually subject to RESPA. */
  cushionMonths?: number;
  projectionPeriodMonths?: number;
}

export interface EscrowAnalysisResult {
  projectedAnnualDisbursementCents: number;
  cushionTargetCents: number;
  /** Projected balance after projectionPeriodMonths if the CURRENT monthly
   *  payment continued unchanged: starting balance + (current payment ×
   *  months) − projected disbursements over the period. */
  projectedEndingBalanceCents: number;
  /** Positive = shortage (need to collect more to reach the cushion target);
   *  negative = surplus. */
  shortageOrSurplusCents: number;
  /** The current payment adjusted by 1/projectionPeriodMonths of the
   *  shortage or surplus, so the cushion target is reached by the end of
   *  the projection period. Floored at 0. */
  newMonthlyEscrowPaymentCents: number;
}

/**
 * Confirmed business methodology (used both for periodic analysis — run
 * twice a year, or ad hoc after an unusually large tax bill — and for
 * setting the initial impound payment at onboarding): project the next 12
 * months of tax + insurance disbursements, compare against current escrow
 * collections, and ensure a 2-month-of-payment buffer will be available.
 */
export function runEscrowAnalysis(input: EscrowAnalysisInput): EscrowAnalysisResult {
  const {
    currentEscrowBalanceCents,
    currentMonthlyEscrowPaymentCents,
    projectedAnnualTaxCents,
    projectedAnnualInsuranceCents,
    cushionMonths = 2,
    projectionPeriodMonths = 12,
  } = input;

  const projectedAnnualDisbursementCents = projectedAnnualTaxCents + projectedAnnualInsuranceCents;

  const cushionTargetCents = new Decimal(currentMonthlyEscrowPaymentCents)
    .mul(cushionMonths)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();

  const projectedEndingBalanceCents =
    currentEscrowBalanceCents + currentMonthlyEscrowPaymentCents * projectionPeriodMonths - projectedAnnualDisbursementCents;

  const shortageOrSurplusCents = cushionTargetCents - projectedEndingBalanceCents;

  const adjustmentPerMonthCents = new Decimal(shortageOrSurplusCents)
    .dividedBy(projectionPeriodMonths)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();

  const newMonthlyEscrowPaymentCents = Math.max(0, currentMonthlyEscrowPaymentCents + adjustmentPerMonthCents);

  return {
    projectedAnnualDisbursementCents,
    cushionTargetCents,
    projectedEndingBalanceCents,
    shortageOrSurplusCents,
    newMonthlyEscrowPaymentCents,
  };
}
