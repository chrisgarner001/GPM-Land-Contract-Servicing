import { describe, expect, it } from "vitest";
import { computeMonthlyPaymentCents, generateSchedule, solveForTermMonths } from "./generateSchedule";

describe("computeMonthlyPaymentCents", () => {
  it("matches the standard fixed-payment formula for a simple case", () => {
    // $100,000 at 6% for 360 months -> known textbook payment ~$599.55
    const paymentCents = computeMonthlyPaymentCents(100_000_00, 6, 360);
    expect(paymentCents).toBe(59_955);
  });

  it("divides evenly when rate is zero", () => {
    const paymentCents = computeMonthlyPaymentCents(120_000, 0, 12);
    expect(paymentCents).toBe(10_000);
  });
});

describe("solveForTermMonths", () => {
  it("inverts computeMonthlyPaymentCents for a round-trip case", () => {
    const principalCents = 100_000_00;
    const annualRatePercent = 6;
    const termMonths = 360;
    const paymentCents = computeMonthlyPaymentCents(principalCents, annualRatePercent, termMonths);
    expect(solveForTermMonths(principalCents, annualRatePercent, paymentCents)).toBe(termMonths);
  });

  it("recovers a 360-month term even when a stated maturity date implies a much shorter one", () => {
    // Real case from the TMO migration: $74,895 at 8% with a $549.55 payment
    // is a 30-year amortization, even though the loan's on-file maturity date
    // was only ~6 years out (a call/balloon provision, not the true term).
    const termMonths = solveForTermMonths(74_895_00, 8, 549_55);
    expect(termMonths).toBe(360);
  });

  it("throws when the payment doesn't cover interest (negative amortization)", () => {
    expect(() => solveForTermMonths(100_000_00, 8, 100)).toThrow();
  });
});

describe("generateSchedule — full amortization", () => {
  it("foots exactly to zero: sum(principal) === original principal, final balance is 0", () => {
    const principalCents = 100_000_00;
    const annualRatePercent = 6;
    const termMonths = 360;
    const paymentAmountCents = computeMonthlyPaymentCents(principalCents, annualRatePercent, termMonths);

    const rows = generateSchedule({
      principalCents,
      annualRatePercent,
      paymentAmountCents,
      amortizationTermMonths: termMonths,
      numberOfPayments: termMonths,
      firstPaymentDate: "2026-01-01",
    });

    expect(rows).toHaveLength(termMonths);

    const sumPrincipal = rows.reduce((acc, r) => acc + r.scheduledPrincipalCents, 0);
    expect(sumPrincipal).toBe(principalCents);
    expect(rows[rows.length - 1].endingBalanceCents).toBe(0);

    // Every row must foot: beginning - principal === ending, and interest+principal === total
    for (const row of rows) {
      expect(row.beginningBalanceCents - row.scheduledPrincipalCents).toBe(row.endingBalanceCents);
      expect(row.scheduledInterestCents + row.scheduledPrincipalCents).toBe(row.scheduledTotalCents);
    }

    // Chained: each row's ending balance must equal the next row's beginning balance
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].beginningBalanceCents).toBe(rows[i - 1].endingBalanceCents);
    }
  });

  it("reconciles an oddball rate/principal that doesn't divide evenly", () => {
    const principalCents = 137_777_33;
    const annualRatePercent = 7.375;
    const termMonths = 180;
    const paymentAmountCents = computeMonthlyPaymentCents(principalCents, annualRatePercent, termMonths);

    const rows = generateSchedule({
      principalCents,
      annualRatePercent,
      paymentAmountCents,
      amortizationTermMonths: termMonths,
      numberOfPayments: termMonths,
      firstPaymentDate: "2026-03-15",
    });

    const sumPrincipal = rows.reduce((acc, r) => acc + r.scheduledPrincipalCents, 0);
    expect(sumPrincipal).toBe(principalCents);
    expect(rows[rows.length - 1].endingBalanceCents).toBe(0);
  });
});

describe("generateSchedule — balloon contract", () => {
  it("stops early with a nonzero ending balance (the balloon due amount)", () => {
    const principalCents = 200_000_00;
    const annualRatePercent = 8;
    const amortizationTermMonths = 360; // payment sized off a 30-year amortization
    const balloonMonths = 60; // but due in full after 5 years
    const paymentAmountCents = computeMonthlyPaymentCents(principalCents, annualRatePercent, amortizationTermMonths);

    const rows = generateSchedule({
      principalCents,
      annualRatePercent,
      paymentAmountCents,
      amortizationTermMonths,
      numberOfPayments: balloonMonths,
      firstPaymentDate: "2026-01-01",
    });

    expect(rows).toHaveLength(balloonMonths);

    const finalRow = rows[rows.length - 1];
    expect(finalRow.endingBalanceCents).toBeGreaterThan(0);
    // Balloon due should be meaningfully less than original principal, but still large
    expect(finalRow.endingBalanceCents).toBeLessThan(principalCents);

    const sumPrincipal = rows.reduce((acc, r) => acc + r.scheduledPrincipalCents, 0);
    expect(sumPrincipal + finalRow.endingBalanceCents).toBe(principalCents);

    // Regular payments throughout — no early payoff row triggered
    for (const row of rows) {
      expect(row.scheduledTotalCents).toBe(paymentAmountCents);
    }
  });
});

describe("generateSchedule — due dates", () => {
  it("advances one calendar month per period, handling month-end rollover", () => {
    const rows = generateSchedule({
      principalCents: 10_000_00,
      annualRatePercent: 5,
      paymentAmountCents: 50_000,
      amortizationTermMonths: 36,
      numberOfPayments: 3,
      firstPaymentDate: "2026-01-31",
    });

    // Feb 2026 has 28 days, so day 31 clamps to Feb 28 — it does not roll into
    // March, and March (31 days) returns to day 31 rather than drifting.
    expect(rows.map((r) => r.dueDate)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });
});
