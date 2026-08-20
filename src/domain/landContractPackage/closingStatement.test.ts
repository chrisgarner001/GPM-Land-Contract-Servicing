import { describe, expect, it } from "vitest";
import { buildClosingStatement, calculateEscrowReserveAmount, calculateReimbursementLine, monthlyEscrowAmount } from "./closingStatement";

describe("buildClosingStatement", () => {
  // Matches a real closing this engine was validated against — figures below
  // are the sample file's cached expected totals.
  const sample = buildClosingStatement({
    buyerName: "Cheikh Thiam",
    sellerName: "Harper Shores Acquisitions, LLC",
    propertyAddress: "19873 Beaconsfield Street, Harper Woods, MI 48225",
    closingDate: "2024-02-15",

    salePrice: 105000,
    sellerReceivesSalePriceInCash: false, // new seller-financed land contract
    earnestMoney: 5000,
    assumedExistingBalance: 70000, // existing land contract balance buyer assumes

    commissions: [
      { description: "Buyer Broker Gross Commission - Signature Sotheby's", amount: 3150 },
      { description: "Listing Broker Commission: EXP Realty", amount: 2065 },
    ],

    buyerFees: [
      { description: "Property Tax", amount: 200 },
      { description: "Homeowner's Insurance Premium", amount: 249.68 },
      { description: "City Property Tax", amount: 450 },
      { description: "Loan Origination Fee: Success", amount: 1750 },
      { description: "Homeowner's Insurance Premium (12 Months)", amount: 1498 },
      { description: "Prepaid interest", amount: 258.9 },
      { description: "Title Settlement Fee to Aaron Cox", amount: 500 },
    ],

    reimbursements: [
      { description: "City Town Taxes paid by seller", amount: 170.35, paidBy: "seller" },
      { description: "County Taxes paid by seller in advance", amount: 350.87, paidBy: "seller" },
    ],
  });

  it("totals the seller ledger correctly", () => {
    expect(sample.sellerLedger.debitTotal).toBeCloseTo(10215, 2);
    expect(sample.sellerLedger.creditTotal).toBeCloseTo(521.22, 2);
  });

  it("totals the buyer ledger correctly", () => {
    expect(sample.buyerLedger.debitTotal).toBeCloseTo(110427.8, 2);
    expect(sample.buyerLedger.creditTotal).toBeCloseTo(75000, 2);
  });

  it("computes cash due from the buyer at closing", () => {
    expect(sample.cashDueFromBuyerAtClosing).toBeCloseTo(35427.8, 2);
  });

  it("computes cash due from the seller when the seller's debits exceed credits", () => {
    expect(sample.cashDueToOrFromSeller.direction).toBe("from seller");
    expect(sample.cashDueToOrFromSeller.amount).toBeCloseTo(9693.78, 2);
  });

  it("treats a new seller-financed sale price as buyer-debit only (no seller credit)", () => {
    const line = sample.lineItems.find((li) => li.description === "Sales Price of Property");
    expect(line?.buyerDebit).toBe(105000);
    expect(line?.sellerCredit).toBeUndefined();
  });

  it("mirrors a cash sale price across both ledgers", () => {
    const cash = buildClosingStatement({
      buyerName: "Buyer",
      sellerName: "Seller",
      propertyAddress: "123 Main St",
      closingDate: "2024-01-01",
      salePrice: 100000,
      sellerReceivesSalePriceInCash: true,
    });
    const line = cash.lineItems.find((li) => li.description === "Sales Price of Property");
    expect(line?.buyerDebit).toBe(100000);
    expect(line?.sellerCredit).toBe(100000);
  });
});

describe("monthlyEscrowAmount", () => {
  it("divides the annual bill by 12", () => {
    expect(monthlyEscrowAmount(2220)).toBe(185);
  });
});

// Figures below match the actual worked examples Jim Woodworth walked
// through with Chris on the 8/20/26 call about how Annie sets up escrow at
// closing — see the transcript in the shared drive. This is a one-sided
// buyer reserve, never a seller proration: the buyer alone funds their own
// future tax/insurance bills, with a standing 2-month cushion.
describe("calculateEscrowReserveAmount", () => {
  it("summer tax bill: collects the accrual gap (bill period start to first payment, minus the covered month) plus the cushion", () => {
    // Bill period starts July 1; first payment October 1 -> 3 calendar months,
    // minus the first-payment month itself = 2 months accrued gap, + 2 cushion = 4 months.
    const amount = calculateEscrowReserveAmount({
      annualAmount: 2220,
      billPeriodStart: "2024-07-01",
      firstPaymentDate: "2024-10-01",
      cushionMonths: 2,
    });
    expect(amount).toBeCloseTo(4 * monthlyEscrowAmount(2220), 2);
  });

  it("winter tax bill: an accrual gap spanning back to last December still resolves the same way", () => {
    // Bill period started last December 1; first payment October 1 -> 10 months,
    // minus the covered month = 9 months accrued gap, + 2 cushion = 11 months.
    const amount = calculateEscrowReserveAmount({
      annualAmount: 2220,
      billPeriodStart: "2023-12-01",
      firstPaymentDate: "2024-10-01",
      cushionMonths: 2,
    });
    expect(amount).toBeCloseTo(11 * monthlyEscrowAmount(2220), 2);
  });

  it("insurance (no billPeriodStart): only the cushion is collected, since the buyer brings a current paid policy to closing", () => {
    // $1200/year insurance, 2-month cushion -> $200, matching the call's example exactly.
    const amount = calculateEscrowReserveAmount({
      annualAmount: 1200,
      firstPaymentDate: "2024-10-01",
      cushionMonths: 2,
    });
    expect(amount).toBe(200);
  });

  it("never goes negative when the bill cycle hasn't started relative to the first payment yet", () => {
    const amount = calculateEscrowReserveAmount({
      annualAmount: 1200,
      billPeriodStart: "2025-01-01",
      firstPaymentDate: "2024-10-01",
      cushionMonths: 2,
    });
    expect(amount).toBe(2 * monthlyEscrowAmount(1200));
  });
});

describe("calculateReimbursementLine", () => {
  it("credits the seller and debits the buyer when the seller paid a buyer-side cost", () => {
    const line = calculateReimbursementLine({ description: "City Town Taxes paid by seller", amount: 170.35, paidBy: "seller" });
    expect(line.buyerDebit).toBe(170.35);
    expect(line.sellerCredit).toBe(170.35);
  });

  it("credits the buyer and debits the seller when the buyer paid a seller-side cost", () => {
    const line = calculateReimbursementLine({ description: "Buyer fronted seller's water bill", amount: 88, paidBy: "buyer" });
    expect(line.sellerDebit).toBe(88);
    expect(line.buyerCredit).toBe(88);
  });
});
