import { centsToDecimal, decimalToCents } from "../money";

export type LateFeeType = "FLAT" | "PERCENT_OF_PI" | "PERCENT_OF_TOTAL_PAYMENT";

// UTC day-diff between a contract's nextPaymentDate and today (or null if not
// yet due). Shared by the contract overview page (display) and the
// makePayment server action (actually deciding the late fee to allocate) so
// the two can never disagree on what's currently due.
export function daysPastDue(nextPaymentDate: string | null): number {
  if (!nextPaymentDate) return 0;
  const due = new Date(`${nextPaymentDate}T00:00:00Z`);
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.max(0, Math.floor((todayUtc.getTime() - due.getTime()) / 86_400_000));
}

export interface CalculateAmountDueInput {
  paymentAmountCents: number;
  daysPastDue: number;
  lateFeeGraceDays: number | null;
  lateFeeType: LateFeeType;
  lateFeeAmountCents: number | null;
  lateFeePercent: string | null;
}

export interface CalculateAmountDueResult {
  amountDueCents: number;
  lateFeeCents: number;
  isLate: boolean;
}

// PERCENT_OF_PI and PERCENT_OF_TOTAL_PAYMENT both apply against
// paymentAmountCents — the schedule doesn't track a separate escrow-inclusive
// total, and every contract in the live data is FLAT (see contracts.ts).
function calculateLateFeeCents(input: CalculateAmountDueInput): number {
  switch (input.lateFeeType) {
    case "FLAT":
      return input.lateFeeAmountCents ?? 0;
    case "PERCENT_OF_PI":
    case "PERCENT_OF_TOTAL_PAYMENT":
      if (!input.lateFeePercent) return 0;
      return decimalToCents(centsToDecimal(input.paymentAmountCents).mul(input.lateFeePercent).dividedBy(100));
  }
}

export function calculateAmountDue(input: CalculateAmountDueInput): CalculateAmountDueResult {
  const isLate = input.daysPastDue > (input.lateFeeGraceDays ?? 0);
  const lateFeeCents = isLate ? calculateLateFeeCents(input) : 0;
  return {
    amountDueCents: input.paymentAmountCents + lateFeeCents,
    lateFeeCents,
    isLate,
  };
}
