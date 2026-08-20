import { describe, expect, it } from "vitest";
import { buildClosingStatement, calculateProrationLine, calculateReimbursementLine, splitProrationShares } from "./closingStatement";

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

describe("splitProrationShares", () => {
  it("splits a full-year amount proportionally by days on each side of the closing date", () => {
    const { sellerShare, buyerShare, sellerDays, buyerDays } = splitProrationShares("2024-07-01", {
      annualAmount: 3650,
      periodStart: "2024-01-01",
      periodEnd: "2024-12-31",
    });
    // 2024 is a leap year: 366 days total, closing on day 183 (Jan1..Jun30 = 182 seller days)
    expect(sellerDays).toBe(182);
    expect(buyerDays).toBe(366 - 182);
    expect(sellerShare + buyerShare).toBeCloseTo(3650, 1);
  });
});

describe("calculateProrationLine", () => {
  const baseInput = {
    description: "Property Tax",
    annualAmount: 3650,
    periodStart: "2024-01-01",
    periodEnd: "2024-12-31",
  };

  it("arrears + buyer will pay: seller is debited now, buyer credited now for seller's share", () => {
    const line = calculateProrationLine("2024-07-01", { ...baseInput, status: "arrears", willPay: "buyer" });
    expect(line.sellerDebit).toBeGreaterThan(0);
    expect(line.buyerCredit).toBe(line.sellerDebit);
    expect(line.sellerCredit).toBeUndefined();
    expect(line.buyerDebit).toBeUndefined();
  });

  it("arrears + seller will pay: buyer is debited now, seller credited now for buyer's share", () => {
    const line = calculateProrationLine("2024-07-01", { ...baseInput, status: "arrears", willPay: "seller" });
    expect(line.buyerDebit).toBeGreaterThan(0);
    expect(line.sellerCredit).toBe(line.buyerDebit);
  });

  it("prepaid by seller: buyer reimburses seller for buyer's share", () => {
    const line = calculateProrationLine("2024-07-01", { ...baseInput, status: "prepaid", paidBy: "seller" });
    expect(line.buyerDebit).toBeGreaterThan(0);
    expect(line.sellerCredit).toBe(line.buyerDebit);
  });

  it("prepaid by buyer: seller reimburses buyer for seller's share", () => {
    const line = calculateProrationLine("2024-07-01", { ...baseInput, status: "prepaid", paidBy: "buyer" });
    expect(line.sellerDebit).toBeGreaterThan(0);
    expect(line.buyerCredit).toBe(line.sellerDebit);
  });

  it("throws when prepaid status is missing paidBy", () => {
    expect(() => calculateProrationLine("2024-07-01", { ...baseInput, status: "prepaid" })).toThrow();
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
