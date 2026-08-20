/**
 * closingStatement.ts
 *
 * Michigan land-contract closing statement calculation engine.
 *
 * Model: two independent, self-balancing ledgers (Seller and Buyer), each with
 * a Debit column and a Credit column — the standard HUD-1 / ALTA settlement
 * statement structure. This is the same structure the Closing Statement.xlsx
 * template uses, and it works whether the sale is cash or seller-financed
 * (land contract), because the "plug" line at the bottom of each ledger
 * (Due from Buyer / Due to or from Seller) absorbs whatever the financing
 * structure leaves over.
 *
 * NOTE ON NAMING: this is a settlement/closing statement, not the federal
 * TRID "Closing Disclosure" (the CFPB 5-page form). TRID's CD generally does
 * NOT apply to seller-financed land contracts UNLESS the seller entity
 * originates more than 3 seller-financed sales in a 12-month period, or is
 * not a natural person/trust/estate. At scale across entities, flag that
 * threshold question to counsel per-entity — this engine does not make that
 * determination.
 */

// ---------- Core types ----------

export type Party = "buyer" | "seller";

export interface LineItem {
  description: string;
  sellerDebit?: number;
  sellerCredit?: number;
  buyerDebit?: number;
  buyerCredit?: number;
}

export interface SimpleFee {
  description: string;
  amount: number;
}

/**
 * Escrow reserve setup for a recurring bill (property tax, insurance) the
 * new escrow/impound account will pay out of in the future. This is NOT a
 * buyer/seller proration — per Aaron Cox and how Annie has always run this
 * (confirmed on a call with Jim Woodworth 8/20/26), the buyer alone funds
 * their own reserve; the seller is never credited or debited for it.
 *
 * The lump sum collected at closing has to cover whatever portion of the
 * CURRENT bill cycle will have already ticked by before the buyer's own
 * monthly escrow payments start catching up, plus a standing cushion (2
 * months, per that call, applied uniformly to every bill including
 * insurance) so the account never runs adjacent to zero.
 */
export interface EscrowReserveInput {
  /** The full annual bill this reserve is funding */
  annualAmount: number;
  /**
   * Start date of the bill cycle currently accruing (e.g. July 1 for a
   * Michigan summer tax bill, December 1 for winter) — whichever occurrence
   * is closest to, and no later than, firstPaymentDate. Omit for a bill with
   * no accrual gap to fund (e.g. insurance, which the buyer brings paid
   * current to closing) — only the cushion applies in that case.
   */
  billPeriodStart?: string;
  /** ISO date the buyer's first monthly (P&I + escrow) payment is due */
  firstPaymentDate: string;
  /** Months of standing safety buffer to collect on top of the accrual gap */
  cushionMonths: number;
}

export interface ReimbursementInput {
  /** A fee one party already paid on the other party's behalf pre-closing */
  description: string;
  amount: number;
  /** Who already paid it (gets credited); the other party is debited */
  paidBy: Party;
}

export interface ClosingStatementInput {
  buyerName: string;
  sellerName: string;
  propertyAddress: string;
  closingDate: string; // ISO date

  salePrice: number;
  earnestMoney?: number;

  /**
   * Balance of an existing land contract or mortgage the buyer is assuming
   * / taking subject to, reducing cash the buyer must bring to closing.
   * (Seller Credit is NOT auto-added for sale price — see note below.)
   */
  assumedExistingBalance?: number;

  /**
   * Set true for a cash-out sale where the seller actually receives the
   * sale price in cash at closing. Set false (default) for a NEW
   * seller-financed land contract, where the sale price is the buyer's
   * total financed obligation, not cash the seller collects today.
   */
  sellerReceivesSalePriceInCash?: boolean;

  commissions?: SimpleFee[]; // always Seller Debit
  buyerFees?: SimpleFee[]; // straightforward Buyer Debit (loan fees, prepaid interest, escrow reserves, etc.)
  sellerFees?: SimpleFee[]; // straightforward Seller Debit
  reimbursements?: ReimbursementInput[];
}

export interface LedgerTotals {
  debitTotal: number;
  creditTotal: number;
  /** The balancing "plug" line: positive = this party owes cash at closing */
  plugAmount: number;
  plugLabel: string;
  /** Which column the plug goes in */
  plugColumn: "debit" | "credit";
  /** Final grand totals after the plug is applied (should be equal) */
  grandTotal: number;
}

export interface ClosingStatementResult {
  lineItems: LineItem[];
  sellerLedger: LedgerTotals;
  buyerLedger: LedgerTotals;
  cashDueFromBuyerAtClosing: number;
  cashDueToOrFromSeller: { amount: number; direction: "to seller" | "from seller" };
}

// ---------- Escrow reserve helper ----------

export function monthlyEscrowAmount(annualAmount: number): number {
  return round2(annualAmount / 12);
}

/** Whole calendar months from a to b (e.g. July 1 -> October 1 = 3), ignoring day-of-month. */
function monthsBetween(a: string, b: string): number {
  const start = new Date(a);
  const end = new Date(b);
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

/**
 * The lump-sum reserve to collect at closing for one bill — see
 * EscrowReserveInput for the reasoning. The month the buyer's first payment
 * falls in is covered by that payment itself, not by the lump sum, so the
 * accrual gap is the month count minus one (floored at zero: if the bill
 * cycle hasn't even started yet relative to the first payment, there's no
 * gap to fund, just the cushion).
 */
export function calculateEscrowReserveAmount(input: EscrowReserveInput): number {
  const monthly = monthlyEscrowAmount(input.annualAmount);
  const accrualGapMonths = input.billPeriodStart ? Math.max(0, monthsBetween(input.billPeriodStart, input.firstPaymentDate) - 1) : 0;
  return round2((accrualGapMonths + input.cushionMonths) * monthly);
}

export function calculateReimbursementLine(r: ReimbursementInput): LineItem {
  if (r.paidBy === "seller") {
    // Seller paid a buyer-side cost already -> buyer owes it (Buyer Debit),
    // seller gets reimbursed (Seller Credit).
    return { description: r.description, buyerDebit: r.amount, sellerCredit: r.amount };
  } else {
    return { description: r.description, sellerDebit: r.amount, buyerCredit: r.amount };
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ---------- Main engine ----------

export function buildClosingStatement(input: ClosingStatementInput): ClosingStatementResult {
  const lineItems: LineItem[] = [];

  // 1. Sale price
  if (input.sellerReceivesSalePriceInCash) {
    lineItems.push({ description: "Sales Price of Property", buyerDebit: input.salePrice, sellerCredit: input.salePrice });
  } else {
    // New seller-financed land contract: buyer's total obligation, not cash to seller today.
    lineItems.push({ description: "Sales Price of Property", buyerDebit: input.salePrice });
  }

  // 2. Earnest money (buyer already paid it; mirrored to seller debit,
  //    since it's money the seller received outside the closing table
  //    that reduces what still needs to flow at closing)
  if (input.earnestMoney) {
    lineItems.push({ description: "Earnest Money Deposit", buyerCredit: input.earnestMoney, sellerDebit: input.earnestMoney });
  }

  // 3. Assumed existing balance (buyer takes over an existing land contract/mortgage)
  if (input.assumedExistingBalance) {
    lineItems.push({ description: "Existing Land Contract Balance Assumed", buyerCredit: input.assumedExistingBalance });
  }

  // 4. Commissions — always seller debit
  for (const c of input.commissions ?? []) {
    lineItems.push({ description: c.description, sellerDebit: c.amount });
  }

  // 5. Straightforward buyer/seller fees (including escrow reserves)
  for (const f of input.buyerFees ?? []) {
    lineItems.push({ description: f.description, buyerDebit: f.amount });
  }
  for (const f of input.sellerFees ?? []) {
    lineItems.push({ description: f.description, sellerDebit: f.amount });
  }

  // 6. Reimbursements (one party fronted a cost for the other pre-closing)
  for (const r of input.reimbursements ?? []) {
    lineItems.push(calculateReimbursementLine(r));
  }

  // ---- Totals ----
  type NumericKey = "sellerDebit" | "sellerCredit" | "buyerDebit" | "buyerCredit";
  const sum = (key: NumericKey) => round2(lineItems.reduce((acc, li) => acc + (li[key] ?? 0), 0));

  const sellerDebitTotal = sum("sellerDebit");
  const sellerCreditTotal = sum("sellerCredit");
  const buyerDebitTotal = sum("buyerDebit");
  const buyerCreditTotal = sum("buyerCredit");

  const sellerLedger = buildLedger(sellerDebitTotal, sellerCreditTotal, "Seller", "Due from Seller", "Due to Seller");
  const buyerLedger = buildLedger(buyerDebitTotal, buyerCreditTotal, "Buyer", "Due from Borrower", "Due to Borrower");

  return {
    lineItems,
    sellerLedger,
    buyerLedger,
    cashDueFromBuyerAtClosing: buyerLedger.plugAmount,
    cashDueToOrFromSeller:
      sellerLedger.plugColumn === "debit"
        ? { amount: sellerLedger.plugAmount, direction: "to seller" }
        : { amount: sellerLedger.plugAmount, direction: "from seller" },
  };
}

/**
 * Generic ledger balancer, matching rows 33-36 of the sample sheet:
 *   if debitTotal > creditTotal: the difference is a "Due from <party>" plug
 *     placed in the CREDIT column (party owes cash / brings cash to closing).
 *   if creditTotal > debitTotal: the difference is a "Due to <party>" plug
 *     placed in the DEBIT column (party receives cash / net proceeds).
 */
function buildLedger(
  debitTotal: number,
  creditTotal: number,
  partyLabel: string,
  dueFromLabel: string,
  dueToLabel: string
): LedgerTotals {
  const diff = round2(debitTotal - creditTotal);
  if (diff >= 0) {
    return {
      debitTotal,
      creditTotal,
      plugAmount: diff,
      plugLabel: dueFromLabel,
      plugColumn: "credit",
      grandTotal: debitTotal,
    };
  } else {
    return {
      debitTotal,
      creditTotal,
      plugAmount: round2(-diff),
      plugLabel: dueToLabel,
      plugColumn: "debit",
      grandTotal: creditTotal,
    };
  }
}
