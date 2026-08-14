import { describe, it, expect } from "vitest";
import { applyPayment } from "./applyPayment";

function sumAllocations(allocations: { amountCents: number }[]): number {
  return allocations.reduce((s, a) => s + a.amountCents, 0);
}

describe("applyPayment", () => {
  it("splits a full payment into interest then principal", () => {
    const result = applyPayment({
      paymentAmountCents: 100_000,
      currentPrincipalBalanceCents: 10_000_000,
      annualRatePercent: 8,
      regularPaymentAmountCents: 100_000,
      existingReserveBalanceCents: 0,
    });
    // Monthly interest = 10,000,000 * (0.08/12) = 66,666.67 -> rounds to 66,667
    expect(result.allocations).toEqual([
      { type: "INTEREST", amountCents: 66_667 },
      { type: "PRINCIPAL", amountCents: 33_333 },
    ]);
    expect(result.newPrincipalBalanceCents).toBe(10_000_000 - 33_333);
    expect(result.heldInReserve).toBe(false);
  });

  it("holds an underpayment entirely in reserve, untouched balance", () => {
    const result = applyPayment({
      paymentAmountCents: 40_000,
      currentPrincipalBalanceCents: 10_000_000,
      annualRatePercent: 8,
      regularPaymentAmountCents: 100_000,
      existingReserveBalanceCents: 0,
    });
    expect(result.allocations).toEqual([{ type: "SUSPENSE", amountCents: 40_000 }]);
    expect(result.newPrincipalBalanceCents).toBe(10_000_000);
    expect(result.heldInReserve).toBe(true);
  });

  it("keeps holding in reserve when combined with prior reserve still falls short", () => {
    const result = applyPayment({
      paymentAmountCents: 30_000,
      currentPrincipalBalanceCents: 10_000_000,
      annualRatePercent: 8,
      regularPaymentAmountCents: 100_000,
      existingReserveBalanceCents: 40_000,
    });
    expect(result.allocations).toEqual([{ type: "SUSPENSE", amountCents: 30_000 }]);
    expect(result.heldInReserve).toBe(true);
  });

  it("draws down held reserve and applies the combined amount once a full payment is reached", () => {
    const result = applyPayment({
      paymentAmountCents: 60_000,
      currentPrincipalBalanceCents: 10_000_000,
      annualRatePercent: 8,
      regularPaymentAmountCents: 100_000,
      existingReserveBalanceCents: 40_000,
    });
    expect(result.heldInReserve).toBe(false);
    expect(result.allocations[0]).toEqual({ type: "SUSPENSE", amountCents: -40_000 });
    // Combined 100,000 applied same as the full-payment case above.
    expect(result.allocations.slice(1)).toEqual([
      { type: "INTEREST", amountCents: 66_667 },
      { type: "PRINCIPAL", amountCents: 33_333 },
    ]);
    expect(result.newPrincipalBalanceCents).toBe(10_000_000 - 33_333);
    // Net of reserve draw-down, allocations must sum to this deposit only.
    expect(sumAllocations(result.allocations)).toBe(60_000);
  });

  it("applies escrow portion after any reserve draw-down, before interest and principal", () => {
    const result = applyPayment({
      paymentAmountCents: 100_000,
      currentPrincipalBalanceCents: 10_000_000,
      annualRatePercent: 8,
      regularPaymentAmountCents: 100_000,
      existingReserveBalanceCents: 0,
      escrowPortionCents: 20_000,
    });
    expect(result.allocations).toEqual([
      { type: "ESCROW_TAX", amountCents: 20_000 },
      { type: "INTEREST", amountCents: 66_667 },
      { type: "PRINCIPAL", amountCents: 13_333 },
    ]);
  });

  it("caps principal at the outstanding balance and routes any excess to SUSPENSE", () => {
    const result = applyPayment({
      paymentAmountCents: 10_100_000,
      currentPrincipalBalanceCents: 10_000_000,
      annualRatePercent: 8,
      regularPaymentAmountCents: 100_000,
      existingReserveBalanceCents: 0,
    });
    expect(result.newPrincipalBalanceCents).toBe(0);
    const suspense = result.allocations.find((a) => a.type === "SUSPENSE");
    expect(suspense?.amountCents).toBeGreaterThan(0);
    expect(sumAllocations(result.allocations)).toBe(10_100_000);
  });

  it("applies a late fee after escrow, before interest and principal", () => {
    const result = applyPayment({
      paymentAmountCents: 113_500,
      currentPrincipalBalanceCents: 10_000_000,
      annualRatePercent: 8,
      regularPaymentAmountCents: 100_000,
      existingReserveBalanceCents: 0,
      lateFeeCents: 7_500,
    });
    expect(result.allocations).toEqual([
      { type: "LATE_FEE", amountCents: 7_500 },
      { type: "INTEREST", amountCents: 66_667 },
      { type: "PRINCIPAL", amountCents: 39_333 },
    ]);
  });

  it("counts the late fee toward whether a deposit satisfies a full payment", () => {
    const result = applyPayment({
      paymentAmountCents: 100_000,
      currentPrincipalBalanceCents: 10_000_000,
      annualRatePercent: 8,
      regularPaymentAmountCents: 100_000,
      existingReserveBalanceCents: 0,
      lateFeeCents: 7_500,
    });
    expect(result.heldInReserve).toBe(true);
    expect(result.allocations).toEqual([{ type: "SUSPENSE", amountCents: 100_000 }]);
  });

  it("applies a charge payment after the late fee, before interest and principal", () => {
    const result = applyPayment({
      paymentAmountCents: 120_000,
      currentPrincipalBalanceCents: 10_000_000,
      annualRatePercent: 8,
      regularPaymentAmountCents: 100_000,
      existingReserveBalanceCents: 0,
      lateFeeCents: 7_500,
      chargePaymentCents: 5_000,
    });
    expect(result.allocations).toEqual([
      { type: "LATE_FEE", amountCents: 7_500 },
      { type: "OTHER_FEE", amountCents: 5_000 },
      { type: "INTEREST", amountCents: 66_667 },
      { type: "PRINCIPAL", amountCents: 40_833 },
    ]);
  });

  it("does not count a charge payment toward whether a deposit satisfies a full payment", () => {
    // The deposit exactly covers the regular payment on its own — a huge
    // charge-payment request on top does NOT push this into held-in-reserve
    // (unlike the late fee, which does gate on the combined total); it's
    // simply capped at whatever's left over after the regular obligation.
    const result = applyPayment({
      paymentAmountCents: 100_000,
      currentPrincipalBalanceCents: 10_000_000,
      annualRatePercent: 8,
      regularPaymentAmountCents: 100_000,
      existingReserveBalanceCents: 0,
      chargePaymentCents: 999_999_999,
    });
    expect(result.heldInReserve).toBe(false);
    expect(result.allocations).toEqual([{ type: "OTHER_FEE", amountCents: 100_000 }]);
  });

  it("caps a charge payment at whatever remains after escrow and late fee", () => {
    const result = applyPayment({
      paymentAmountCents: 100_000,
      currentPrincipalBalanceCents: 10_000_000,
      annualRatePercent: 8,
      regularPaymentAmountCents: 100_000,
      existingReserveBalanceCents: 0,
      escrowPortionCents: 97_000,
      chargePaymentCents: 50_000,
    });
    expect(result.allocations.find((a) => a.type === "OTHER_FEE")).toEqual({ type: "OTHER_FEE", amountCents: 3_000 });
    expect(sumAllocations(result.allocations)).toBe(100_000);
  });

  it("never allocates more than this deposit across all buckets, net of any reserve draw-down", () => {
    const result = applyPayment({
      paymentAmountCents: 55_555,
      currentPrincipalBalanceCents: 500_000,
      annualRatePercent: 11,
      regularPaymentAmountCents: 50_000,
      existingReserveBalanceCents: 10_000,
    });
    expect(sumAllocations(result.allocations)).toBe(55_555);
  });
});
