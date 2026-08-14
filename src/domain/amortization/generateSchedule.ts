import Decimal from "decimal.js";
import { annualRateToMonthlyDecimal } from "../money";

export interface ScheduledPaymentRow {
  periodNumber: number;
  dueDate: string; // ISO yyyy-mm-dd
  beginningBalanceCents: number;
  scheduledInterestCents: number;
  scheduledPrincipalCents: number;
  scheduledTotalCents: number;
  endingBalanceCents: number;
}

export interface GenerateScheduleInput {
  principalCents: number;
  annualRatePercent: number;
  paymentAmountCents: number;
  /** The term paymentAmountCents was sized against (via computeMonthlyPaymentCents
   *  or the contract's original terms). This period is where the schedule forces
   *  an exact payoff, absorbing any rounding residual from the level payment. */
  amortizationTermMonths: number;
  /** Number of scheduled rows to actually generate. Equal to amortizationTermMonths
   *  for a standard fully-amortizing loan. For a balloon contract this is fewer —
   *  the schedule simply stops with a nonzero endingBalanceCents (the balloon due),
   *  since period never reaches amortizationTermMonths. */
  numberOfPayments: number;
  firstPaymentDate: string; // ISO yyyy-mm-dd
}

/**
 * Standard fixed-payment amortization formula, used when originating a new
 * contract to derive the level payment for a given principal/rate/term.
 * Existing/migrated contracts should use their already-known paymentAmountCents
 * instead of recomputing this.
 */
export function computeMonthlyPaymentCents(
  principalCents: number,
  annualRatePercent: number,
  termMonths: number
): number {
  const monthlyRate = annualRateToMonthlyDecimal(annualRatePercent);
  const principal = new Decimal(principalCents);

  if (monthlyRate.isZero()) {
    return principal.dividedBy(termMonths).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  }

  const onePlusR = monthlyRate.plus(1);
  const factor = monthlyRate.dividedBy(new Decimal(1).minus(onePlusR.pow(-termMonths)));
  return principal.mul(factor).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Inverse of the standard amortization formula: given a known principal,
 * rate, and level payment (e.g. from a migrated/legacy loan where the term
 * itself isn't reliably recorded), solves for how many months it takes to
 * fully amortize. Prefer this over a maturity-date-derived term whenever the
 * loan is known to be fully amortizing — a stated maturity/call date can
 * reflect a balloon or call provision unrelated to the payment's actual
 * amortization length, which would otherwise corrupt the generated schedule.
 *
 * n = -ln(1 - r*P/A) / ln(1+r)
 */
export function solveForTermMonths(principalCents: number, annualRatePercent: number, paymentAmountCents: number): number {
  const monthlyRate = annualRateToMonthlyDecimal(annualRatePercent);
  const principal = new Decimal(principalCents);
  const payment = new Decimal(paymentAmountCents);

  if (monthlyRate.isZero()) {
    return Math.round(principal.dividedBy(payment).toNumber());
  }

  const ratio = monthlyRate.mul(principal).dividedBy(payment);
  if (ratio.gte(1)) {
    throw new Error("Payment does not cover interest — cannot solve for an amortizing term (negative amortization).");
  }
  const n = new Decimal(1).minus(ratio).ln().neg().dividedBy(monthlyRate.plus(1).ln());
  return Math.round(n.toNumber());
}

/**
 * Adds calendar months to `date`, clamping to the last day of the target month
 * when the original day doesn't exist there (e.g. Jan 31 + 1 month -> Feb 28,
 * not a rollover into March). Always computed from the same origin day so the
 * due-day-of-month never permanently drifts after a short month.
 */
function addMonths(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const targetYear = date.getUTCFullYear();
  const targetMonthIndex = date.getUTCMonth() + months;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonthIndex, Math.min(day, daysInTargetMonth)));
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Generates a versioned amortization schedule as a pure function — no DB/framework
 * dependency, so it can be unit-tested directly and re-run for modifications/re-ams.
 *
 * Rounding is reconciled on the final payoff row: on the period where the
 * loan is scheduled to fully amortize (period === amortizationTermMonths), or
 * whenever the computed principal portion would meet or exceed the remaining
 * balance (an early payoff), that row absorbs the exact remaining balance
 * instead of the level principal portion — so the sum of every scheduled
 * principal row plus the final endingBalanceCents always equals the original
 * principalCents exactly (never off by a rounding cent from the level
 * payment not quite dividing the balance to zero on its own).
 */
export function generateSchedule(input: GenerateScheduleInput): ScheduledPaymentRow[] {
  const { principalCents, annualRatePercent, paymentAmountCents, amortizationTermMonths, numberOfPayments, firstPaymentDate } = input;
  const monthlyRate = annualRateToMonthlyDecimal(annualRatePercent);

  const rows: ScheduledPaymentRow[] = [];
  let balance = new Decimal(principalCents);
  const originDate = new Date(`${firstPaymentDate}T00:00:00Z`);

  for (let period = 1; period <= numberOfPayments; period++) {
    const beginningBalanceCents = balance.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
    if (beginningBalanceCents <= 0) break;
    // Computed from the same origin day every period (not incrementally from
    // the previous due date) so a short month's clamp never causes drift.
    const dueDate = addMonths(originDate, period - 1);

    const interestCents = balance
      .mul(monthlyRate)
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      .toNumber();

    let principalPortionCents = paymentAmountCents - interestCents;
    let totalCents = paymentAmountCents;

    const isScheduledPayoffPeriod = period === amortizationTermMonths;
    if (principalPortionCents >= beginningBalanceCents || isScheduledPayoffPeriod) {
      // Payoff row: absorb the exact remaining balance rather than the level
      // principal portion, so the schedule foots to zero precisely. Only
      // triggered by reaching amortizationTermMonths (never by numberOfPayments
      // alone), so a balloon's shorter schedule doesn't get force-zeroed.
      principalPortionCents = beginningBalanceCents;
      totalCents = interestCents + principalPortionCents;
    }

    const endingBalanceCents = beginningBalanceCents - principalPortionCents;

    rows.push({
      periodNumber: period,
      dueDate: formatDate(dueDate),
      beginningBalanceCents,
      scheduledInterestCents: interestCents,
      scheduledPrincipalCents: principalPortionCents,
      scheduledTotalCents: totalCents,
      endingBalanceCents,
    });

    balance = new Decimal(endingBalanceCents);
  }

  return rows;
}
