export type PaymentFrequency = "MONTHLY" | "SEMI_MONTHLY" | "BIWEEKLY";

// Moves the due date forward by exactly one period, regardless of how much
// was paid — overpayment is tracked separately via the reserve balance, not
// by skipping ahead multiple periods. Every contract in the live data is
// MONTHLY (confirmed via direct query), but the other enum values are
// implemented for correctness since the schema allows them.
export function advanceNextPaymentDate(currentDueDate: string, frequency: PaymentFrequency): string {
  const date = new Date(`${currentDueDate}T00:00:00Z`);

  switch (frequency) {
    case "MONTHLY": {
      const day = date.getUTCDate();
      date.setUTCDate(1);
      date.setUTCMonth(date.getUTCMonth() + 1);
      const daysInNewMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
      date.setUTCDate(Math.min(day, daysInNewMonth));
      break;
    }
    case "SEMI_MONTHLY":
      date.setUTCDate(date.getUTCDate() + 15);
      break;
    case "BIWEEKLY":
      date.setUTCDate(date.getUTCDate() + 14);
      break;
  }

  return date.toISOString().slice(0, 10);
}

// Inverse of advanceNextPaymentDate, used when a payment is reversed. Exact
// for SEMI_MONTHLY/BIWEEKLY; for MONTHLY, a due date that was clamped to a
// shorter month (e.g. Jan 31 -> Feb 28) regresses to the 28th rather than the
// original 31st — an accepted rounding edge case, same tradeoff as the
// forward clamp.
export function regressNextPaymentDate(currentDueDate: string, frequency: PaymentFrequency): string {
  const date = new Date(`${currentDueDate}T00:00:00Z`);

  switch (frequency) {
    case "MONTHLY": {
      const day = date.getUTCDate();
      date.setUTCDate(1);
      date.setUTCMonth(date.getUTCMonth() - 1);
      const daysInNewMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
      date.setUTCDate(Math.min(day, daysInNewMonth));
      break;
    }
    case "SEMI_MONTHLY":
      date.setUTCDate(date.getUTCDate() - 15);
      break;
    case "BIWEEKLY":
      date.setUTCDate(date.getUTCDate() - 14);
      break;
  }

  return date.toISOString().slice(0, 10);
}
