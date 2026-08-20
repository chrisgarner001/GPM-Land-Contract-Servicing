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

export interface ProrationInput {
  description: string;
  /** Full annual (or full-period) amount being prorated */
  annualAmount: number;
  /** ISO date strings, e.g. "2024-01-01" */
  periodStart: string;
  periodEnd: string;
  /**
   * "prepaid": paidBy already paid for the full period in advance
   *            (e.g. seller prepaid homeowner's insurance or paid taxes
   *            in advance) -> the other party reimburses paidBy's share.
   * "arrears": the bill has NOT been paid yet and will be paid later,
   *            after closing, by whichever party owns at the time it's due
   *            (typical MI property tax/assessment) -> the party who will
   *            eventually pay gets credited for the other party's share now.
   */
  status: "prepaid" | "arrears";
  /** Required when status === "prepaid": who already paid it */
  paidBy?: Party;
  /**
   * Required when status === "arrears": who will actually pay the bill
   * when it comes due (almost always "buyer" for MI property taxes,
   * since the buyer owns the property going forward).
   */
  willPay?: Party;
  dayCountConvention?: 360 | 365;
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
  buyerFees?: SimpleFee[]; // straightforward Buyer Debit (loan fees, prepaid interest, buyer's title costs, etc.)
  sellerFees?: SimpleFee[]; // straightforward Seller Debit
  prorations?: ProrationInput[];
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

// ---------- Proration helper ----------

function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/**
 * Splits an annual/period amount into seller's share and buyer's share
 * based on the closing date. Seller owns through the day before closing;
 * buyer owns from the closing date forward (standard MI convention —
 * adjust the +1 if your title company uses a different cutoff).
 */
export function splitProrationShares(
  closingDate: string,
  input: Pick<ProrationInput, "annualAmount" | "periodStart" | "periodEnd" | "dayCountConvention">
): { sellerShare: number; buyerShare: number; sellerDays: number; buyerDays: number } {
  const convention = input.dayCountConvention ?? 365;
  const start = new Date(input.periodStart);
  const end = new Date(input.periodEnd);
  const closing = new Date(closingDate);

  const totalDays = daysBetween(start, end) + 1;
  const sellerDays = Math.max(0, daysBetween(start, closing));
  const buyerDays = Math.max(0, totalDays - sellerDays);

  const dailyRate = input.annualAmount / (convention === 360 ? 360 : totalDays);

  return {
    sellerShare: round2(dailyRate * sellerDays),
    buyerShare: round2(dailyRate * buyerDays),
    sellerDays,
    buyerDays,
  };
}

export function calculateProrationLine(closingDate: string, p: ProrationInput): LineItem {
  const { sellerShare, buyerShare } = splitProrationShares(closingDate, p);

  if (p.status === "prepaid") {
    if (!p.paidBy) throw new Error(`Proration "${p.description}": paidBy is required when status is "prepaid"`);
    if (p.paidBy === "seller") {
      // Seller already paid for the whole period; buyer reimburses seller for buyer's share.
      return { description: p.description, sellerCredit: buyerShare, buyerDebit: buyerShare };
    } else {
      return { description: p.description, buyerCredit: sellerShare, sellerDebit: sellerShare };
    }
  } else {
    // arrears: bill unpaid, will be paid later by willPay
    const willPay = p.willPay ?? "buyer";
    if (willPay === "buyer") {
      // Buyer will pay the full bill later, covering seller's period too ->
      // seller owes buyer credit now for seller's portion.
      return { description: p.description, sellerDebit: sellerShare, buyerCredit: sellerShare };
    } else {
      return { description: p.description, buyerDebit: buyerShare, sellerCredit: buyerShare };
    }
  }
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

  // 4. Prorations
  for (const p of input.prorations ?? []) {
    lineItems.push(calculateProrationLine(input.closingDate, p));
  }

  // 5. Commissions — always seller debit
  for (const c of input.commissions ?? []) {
    lineItems.push({ description: c.description, sellerDebit: c.amount });
  }

  // 6. Straightforward buyer/seller fees
  for (const f of input.buyerFees ?? []) {
    lineItems.push({ description: f.description, buyerDebit: f.amount });
  }
  for (const f of input.sellerFees ?? []) {
    lineItems.push({ description: f.description, sellerDebit: f.amount });
  }

  // 7. Reimbursements (one party fronted a cost for the other pre-closing)
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
