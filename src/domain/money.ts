import Decimal from "decimal.js";

/**
 * Money is always represented as whole cents (bigint-safe integers) at rest
 * and at every domain/API boundary. Decimal is only used transiently inside
 * rate/amortization math; every function here returns whole cents.
 */

export function centsToDecimal(cents: number): Decimal {
  return new Decimal(cents).dividedBy(100);
}

export function decimalToCents(value: Decimal): number {
  return value.mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

export function annualRateToMonthlyDecimal(annualRatePercent: number): Decimal {
  return new Decimal(annualRatePercent).dividedBy(100).dividedBy(12);
}

export function annualRateToDailyDecimal365(annualRatePercent: number): Decimal {
  return new Decimal(annualRatePercent).dividedBy(100).dividedBy(365);
}
