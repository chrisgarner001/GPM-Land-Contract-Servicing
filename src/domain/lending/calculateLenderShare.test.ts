import { describe, expect, it } from "vitest";
import { calculateLenderShare } from "./calculateLenderShare";

describe("calculateLenderShare", () => {
  it("matches a real TMO lender ledger credit (100% ownership, $45 flat fee)", () => {
    // Real case: Angel Briggs's $1,286.52 regular payment nets exactly
    // $1,241.52 into Balfour Avenue, LLC's lender ledger.
    const netCents = calculateLenderShare({
      paymentAmountCents: 1_286_52,
      ownershipPercent: 100,
      brokerServicingFeeCents: 45_00,
    });
    expect(netCents).toBe(1_241_52);
  });

  it("splits a fractional ownership payment and rounds to the nearest cent", () => {
    const netCents = calculateLenderShare({
      paymentAmountCents: 100_00,
      ownershipPercent: 33.33,
      brokerServicingFeeCents: 0,
    });
    expect(netCents).toBe(3_333);
  });

  it("defaults to no fee when none is configured", () => {
    const netCents = calculateLenderShare({ paymentAmountCents: 500_00, ownershipPercent: 50 });
    expect(netCents).toBe(250_00);
  });

  it("splitting interest and principal separately (fee 0 each) sums to the same net as one combined call with the fee applied once", () => {
    // Lender Payment Runs composes calculateLenderShare this way: once on
    // the combined interest+principal amount (with the real fee) to get the
    // authoritative net credit, and once per component with fee=0 purely to
    // get a display-only interest/principal split. This must always
    // reconcile — the split is never allowed to imply a different total.
    const interestCents = 700_00;
    const principalCents = 586_52;
    const ownershipPercent = 100;
    const brokerServicingFeeCents = 45_00;

    const netCents = calculateLenderShare({
      paymentAmountCents: interestCents + principalCents,
      ownershipPercent,
      brokerServicingFeeCents,
    });
    const interestShareCents = calculateLenderShare({ paymentAmountCents: interestCents, ownershipPercent, brokerServicingFeeCents: 0 });
    const principalShareCents = calculateLenderShare({ paymentAmountCents: principalCents, ownershipPercent, brokerServicingFeeCents: 0 });

    expect(interestShareCents + principalShareCents - brokerServicingFeeCents).toBe(netCents);
  });
});
