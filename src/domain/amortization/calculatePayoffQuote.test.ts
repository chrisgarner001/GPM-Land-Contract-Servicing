import { describe, expect, it } from "vitest";
import { calculatePayoffQuote } from "./calculatePayoffQuote";

describe("calculatePayoffQuote", () => {
  it("matches a real TMO payoff (8% rate, 9 elapsed days -> 10 inclusive)", () => {
    // Real case: balance $65,584.76 @ 8%, last due 9/1/2021, payoff 9/10/2021,
    // TMO charged exactly $143.75 interest.
    const quote = calculatePayoffQuote({
      principalBalanceCents: 65_584_76,
      annualRatePercent: 8,
      lastDueDate: "2021-09-01",
      payoffDate: "2021-09-10",
    });
    expect(quote.days).toBe(10);
    expect(quote.accruedInterestCents).toBe(14_375);
    expect(quote.totalPayoffAmountCents).toBe(65_584_76 + 14_375);
  });

  it("matches a real TMO payoff (12% rate, 17 elapsed days -> 18 inclusive)", () => {
    // Real case: balance $8,172.81 @ 12%, last due 6/1/2021, payoff 6/18/2021,
    // TMO charged exactly $48.37 interest.
    const quote = calculatePayoffQuote({
      principalBalanceCents: 8_172_81,
      annualRatePercent: 12,
      lastDueDate: "2021-06-01",
      payoffDate: "2021-06-18",
    });
    expect(quote.days).toBe(18);
    expect(quote.accruedInterestCents).toBe(4_837);
  });

  it("includes unpaid charges carried forward in the total", () => {
    const quote = calculatePayoffQuote({
      principalBalanceCents: 10_000_00,
      annualRatePercent: 6,
      lastDueDate: "2026-01-01",
      payoffDate: "2026-01-01",
      unpaidLateChargesCents: 7_500,
      unpaidOtherChargesCents: 4_000,
      unpaidInterestCents: 1_200,
    });
    expect(quote.days).toBe(1);
    expect(quote.totalPayoffAmountCents).toBe(10_000_00 + quote.accruedInterestCents + 7_500 + 4_000 + 1_200);
  });

  it("throws if the payoff date is before the last due date", () => {
    expect(() =>
      calculatePayoffQuote({
        principalBalanceCents: 10_000_00,
        annualRatePercent: 6,
        lastDueDate: "2026-02-01",
        payoffDate: "2026-01-01",
      })
    ).toThrow();
  });
});
