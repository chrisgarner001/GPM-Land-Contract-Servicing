import Decimal from "decimal.js";
import { annualRateToDailyDecimal365 } from "../money";

export interface PayoffQuoteInput {
  principalBalanceCents: number;
  annualRatePercent: number;
  /** The last due date the loan is paid through (not the last payment's
   *  received date — TMO's per-diem window runs from the due date). */
  lastDueDate: string; // ISO yyyy-mm-dd
  payoffDate: string; // ISO yyyy-mm-dd
  unpaidLateChargesCents?: number;
  unpaidOtherChargesCents?: number;
  /** Any interest already accrued/unpaid from prior periods, carried forward
   *  separately from this payoff's own per-diem interest. */
  unpaidInterestCents?: number;
}

export interface PayoffQuote {
  days: number;
  perDiemInterestCents: number;
  accruedInterestCents: number;
  principalBalanceCents: number;
  unpaidLateChargesCents: number;
  unpaidOtherChargesCents: number;
  unpaidInterestCents: number;
  totalPayoffAmountCents: number;
}

/**
 * Payoff/per-diem interest — confirmed empirically against 47/50 real TMO
 * payoff transactions (within $1): actual/365 daily simple interest, counted
 * INCLUSIVELY from the last serviced due date through the payoff date. This
 * is a different convention from the regular monthly schedule (30/360 — see
 * generateSchedule.ts) and applies regardless of the contract's configured
 * interestMethod, which only governs the regular scheduled payments.
 */
export function calculatePayoffQuote(input: PayoffQuoteInput): PayoffQuote {
  const {
    principalBalanceCents,
    annualRatePercent,
    lastDueDate,
    payoffDate,
    unpaidLateChargesCents = 0,
    unpaidOtherChargesCents = 0,
    unpaidInterestCents = 0,
  } = input;

  const due = new Date(`${lastDueDate}T00:00:00Z`);
  const payoff = new Date(`${payoffDate}T00:00:00Z`);
  const days = Math.round((payoff.getTime() - due.getTime()) / 86_400_000) + 1;
  if (days < 1) {
    throw new Error("payoffDate must be on or after lastDueDate");
  }

  const dailyRate = annualRateToDailyDecimal365(annualRatePercent);
  const perDiemInterestCents = new Decimal(principalBalanceCents)
    .mul(dailyRate)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
  const accruedInterestCents = new Decimal(principalBalanceCents)
    .mul(dailyRate)
    .mul(days)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();

  const totalPayoffAmountCents =
    principalBalanceCents + accruedInterestCents + unpaidInterestCents + unpaidLateChargesCents + unpaidOtherChargesCents;

  return {
    days,
    perDiemInterestCents,
    accruedInterestCents,
    principalBalanceCents,
    unpaidLateChargesCents,
    unpaidOtherChargesCents,
    unpaidInterestCents,
    totalPayoffAmountCents,
  };
}
