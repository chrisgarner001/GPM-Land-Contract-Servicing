import Decimal from "decimal.js";

export interface LenderShareInput {
  paymentAmountCents: number;
  ownershipPercent: number; // e.g. 100 for 100%, 33.33 for a fractional split
  /** Flat dollar amount only — confirmed live that this business never uses a
   *  percentage-based or note/lender-rate-spread broker servicing fee. */
  brokerServicingFeeCents?: number;
}

/**
 * A lender's net credit for a single borrower payment: their ownership share
 * of the payment, minus the flat broker servicing fee, deducted BEFORE the
 * lender's clearing ledger is credited (confirmed against real TMO data —
 * e.g. a $1,286.52 payment at 100% ownership with a $45.00 fee nets exactly
 * $1,241.52 into the lender's ledger, never the gross amount).
 */
export function calculateLenderShare(input: LenderShareInput): number {
  const { paymentAmountCents, ownershipPercent, brokerServicingFeeCents = 0 } = input;

  const grossShareCents = new Decimal(paymentAmountCents)
    .mul(ownershipPercent)
    .dividedBy(100)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();

  return grossShareCents - brokerServicingFeeCents;
}
