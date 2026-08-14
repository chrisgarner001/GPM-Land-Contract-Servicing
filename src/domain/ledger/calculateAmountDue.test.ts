import { describe, expect, it } from "vitest";
import { calculateAmountDue } from "./calculateAmountDue";

describe("calculateAmountDue", () => {
  it("is not late within the grace period", () => {
    const result = calculateAmountDue({
      paymentAmountCents: 106_000,
      daysPastDue: 15,
      lateFeeGraceDays: 15,
      lateFeeType: "FLAT",
      lateFeeAmountCents: 7_500,
      lateFeePercent: null,
    });
    expect(result).toEqual({ amountDueCents: 106_000, lateFeeCents: 0, isLate: false });
  });

  it("adds a flat late fee once past the grace period", () => {
    const result = calculateAmountDue({
      paymentAmountCents: 106_000,
      daysPastDue: 16,
      lateFeeGraceDays: 15,
      lateFeeType: "FLAT",
      lateFeeAmountCents: 7_500,
      lateFeePercent: null,
    });
    expect(result).toEqual({ amountDueCents: 113_500, lateFeeCents: 7_500, isLate: true });
  });

  it("applies a percent-of-payment late fee, rounded to the cent", () => {
    const result = calculateAmountDue({
      paymentAmountCents: 106_000,
      daysPastDue: 20,
      lateFeeGraceDays: 10,
      lateFeeType: "PERCENT_OF_PI",
      lateFeeAmountCents: null,
      lateFeePercent: "5.00",
    });
    expect(result).toEqual({ amountDueCents: 111_300, lateFeeCents: 5_300, isLate: true });
  });

  it("treats a null grace period as zero days", () => {
    const result = calculateAmountDue({
      paymentAmountCents: 106_000,
      daysPastDue: 1,
      lateFeeGraceDays: null,
      lateFeeType: "FLAT",
      lateFeeAmountCents: 7_500,
      lateFeePercent: null,
    });
    expect(result.isLate).toBe(true);
  });

  it("charges no late fee when not yet due", () => {
    const result = calculateAmountDue({
      paymentAmountCents: 106_000,
      daysPastDue: 0,
      lateFeeGraceDays: 15,
      lateFeeType: "FLAT",
      lateFeeAmountCents: 7_500,
      lateFeePercent: null,
    });
    expect(result).toEqual({ amountDueCents: 106_000, lateFeeCents: 0, isLate: false });
  });
});
