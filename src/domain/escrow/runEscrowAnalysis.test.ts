import { describe, expect, it } from "vitest";
import { runEscrowAnalysis } from "./runEscrowAnalysis";

describe("runEscrowAnalysis", () => {
  it("computes a shortage and raises the monthly payment to close it plus the 2-month cushion", () => {
    const result = runEscrowAnalysis({
      currentEscrowBalanceCents: 200_00,
      currentMonthlyEscrowPaymentCents: 250_00,
      projectedAnnualTaxCents: 2_600_00,
      projectedAnnualInsuranceCents: 1_000_00,
    });

    expect(result.projectedAnnualDisbursementCents).toBe(3_600_00);
    expect(result.cushionTargetCents).toBe(500_00); // 2 months of the $250 current payment
    // 200 + (250*12) - 3600 = -400.00 projected ending balance
    expect(result.projectedEndingBalanceCents).toBe(-400_00);
    // shortage = cushion target (500) - projected ending balance (-400) = 900
    expect(result.shortageOrSurplusCents).toBe(900_00);
    // 250 + 900/12 = 250 + 75.00 -> 325.00
    expect(result.newMonthlyEscrowPaymentCents).toBe(325_00);
  });

  it("lowers the monthly payment when a surplus is projected", () => {
    const result = runEscrowAnalysis({
      currentEscrowBalanceCents: 5_000_00,
      currentMonthlyEscrowPaymentCents: 300_00,
      projectedAnnualTaxCents: 1_200_00,
      projectedAnnualInsuranceCents: 800_00,
    });

    // 5000 + (300*12) - 2000 = 6600 projected ending balance, cushion target = 2 months of $300 = 600
    expect(result.projectedEndingBalanceCents).toBe(6_600_00);
    expect(result.shortageOrSurplusCents).toBe(600_00 - 6_600_00);
    expect(result.newMonthlyEscrowPaymentCents).toBeLessThan(300_00);
  });

  it("never returns a negative monthly payment even with a very large surplus", () => {
    const result = runEscrowAnalysis({
      currentEscrowBalanceCents: 100_000_00,
      currentMonthlyEscrowPaymentCents: 300_00,
      projectedAnnualTaxCents: 1_000_00,
      projectedAnnualInsuranceCents: 0,
    });
    expect(result.newMonthlyEscrowPaymentCents).toBe(0);
  });

  it("supports a custom cushion (months) and projection period (e.g. a large-bill triggered re-analysis)", () => {
    const result = runEscrowAnalysis({
      currentEscrowBalanceCents: 0,
      currentMonthlyEscrowPaymentCents: 100_00,
      projectedAnnualTaxCents: 1_200_00,
      projectedAnnualInsuranceCents: 0,
      cushionMonths: 3,
      projectionPeriodMonths: 6,
    });
    expect(result.cushionTargetCents).toBe(300_00); // 3 months of the $100 current payment
  });
});
