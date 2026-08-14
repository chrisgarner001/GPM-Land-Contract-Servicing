# Contracts — Interaction Design

## Entry Points
- `/contracts` — top-level nav destination; the loan book / portfolio list.
- `/contracts/[contractId]` — reached by clicking a contract number link from the Contracts list, the Borrowers list, a borrower detail page, or (implicitly) other cross-linked pages.
- `/contracts/[contractId]/terms`, `/history`, `/trust-ledger`, `/escrow-analysis`, `/funding` — tab navigation (`ContractTabs`, client component using `usePathname` to highlight the active tab) rendered inside the shared `layout.tsx` header (buyer name(s), status badge, balloon badge, account #, property address, principal balance, current lender(s)).
- `/contracts/[contractId]/history` is also reached via "View all" from the Overview page's Recent Payments panel; `/trust-ledger` via "View all" from Recent Escrow Activity.

## Primary Flow — Recording a Payment
1. Staff opens `/contracts/[contractId]` (Overview tab, the default `page.tsx` under the contract layout).
2. Server computes `amountDue` (`calculateAmountDue`, driven by `daysPastDue(contract.nextPaymentDate)` and the contract's late-fee config) plus the current escrow portion (`getCurrentEscrowPortionCents`, derived from the most recent CLEARED `ESCROW_TAX` allocation) to get `fullAmountDueCents`.
3. Staff clicks **Record Payment** (`RecordPaymentModal`) — opens a native `<dialog>` pre-filled with the computed amount due, escrow portion, and late fee (all editable).
4. As staff edits Amount/Escrow/Late Fee/Charge Payment/Apply-Reserve, a client-side call to the same `applyPayment` domain function used server-side re-renders a live "Payment Distribution" preview (principal/interest/escrow/late fee/charges/reserve-held-or-drawn) — no round trip.
5. Staff sets Payment Method (Check/Cash/ACH/Card), Reference, Received Date, and submits.
6. Server action `makePayment` (`src/app/contracts/[contractId]/actions.ts`) validates inputs (positive amount, non-negative escrow/late-fee/charge amounts, valid method), reads the Supabase user for `actorEmail`, and calls `recordPayment` (`src/server/payments.ts`).
7. `recordPayment` re-runs `applyPayment` server-side (never trusts the client preview), inserts a `payments` row + `paymentAllocations` rows in a transaction, applies any charge-payment FIFO against `contractCharges` and credits active lenders, updates `contracts.currentPrincipalBalanceCents`, advances `nextPaymentDate` (unless held in reserve), and flips status to `PAID_OFF` if the balance reaches zero.
8. On success the dialog closes (`useEffect` watching `state.success`) and `revalidatePath` refreshes `/contracts/[contractId]`, `/history`, `/contracts`, and `/lenders`.
9. On a held-in-reserve deposit, the success message reads "Payment recorded and held in reserve — not yet enough for a full payment."; the distribution preview instead shows an amber notice with no principal/interest/late-fee breakdown.

## States & Transitions
- **Loading**: none explicit — pages are server components; the modal shows "Recording..."/"Running..."/"Saving..." on submit buttons while `pending` from `useActionState` is true.
- **Empty states**: "No payments recorded." (Overview, History), "No escrow vouchers available." / "No analyses run yet." (Escrow Analysis), "No active lender funding on record for this contract." / "No previous funding on record." (Funding), "No notes yet.", "No Google Drive folder linked yet.", "No trust account activity recorded."
- **Validation failure**: each server action returns `{ error: string }` rendered inline in red near the relevant form (e.g. "Enter a valid payment amount.", "Contract not found.", "Enter a valid https:// link.").
- **Success**: green inline confirmation text (e.g. "Payment recorded and applied.", "Funding recorded.", "Analysis run and saved.", "Attachments link updated.", "Court status updated.").
- **Reversal confirmation**: `ReversePaymentButton` uses a native `confirm()` browser dialog before submitting; a reversal-in-progress button disables and reads "Reversing...".
- **Reversal restriction error**: attempting to reverse anything other than the single most recent CLEARED/non-reversal payment surfaces "Only the most recent payment can be reversed — contact an administrator for older corrections." (thrown from `reversePayment`, caught in the action, shown inline).
- **Delinquency visual states**: contract rows/badges shift color at 30+ (blue), 60+ (yellow), 90+ (red) days past due, computed identically in the list page and the `StatusCard` — but only for `status === "ACTIVE"` contracts.

## Secondary Flows / Edge Cases
- **Delinquency bucket filters** on the list page are mutually exclusive tiers (e.g. clicking "60+ days" shows only 60-89, not 90+ too) — the code comment explains this was a deliberate fix so each button's results aren't dominated by the same worst-case 90+ contracts.
- **Split/multiple lenders**: the list page fetches current lender names in a separate query from the main contract join specifically to avoid row fan-out when a contract has more than one active INVESTOR_PAYEE.
- **Reserve draw-down combined with a new deposit**: when "Apply Reserve" is checked and the combined total covers a full payment, the existing reserve is zeroed (negative SUSPENSE allocation) and the whole combined amount is allocated as one payment.
- **Overpayment / payoff excess**: if a payment exceeds the amount needed to pay off principal, the remainder is held as a new (positive) SUSPENSE entry rather than going negative.
- **Charge repayment**: any "Pay Charges" amount is applied FIFO (oldest `chargeDate` first) against outstanding `contractCharges`, and the applied amount is credited back to whichever lender(s) are currently active via `creditActiveLenders`.
- **Adding new lender funding**: if there was exactly one prior active lender, its broker servicing fee is carried forward to the new funding row; with co-investors (more than one prior active lender) the fee is deliberately left null for staff to set explicitly.
- **Legal process fields** (Court Status form) are fully optional/nullable and independent of the coarse "Legal Process Stage" badge — a contract can have some dates set without a matching stage, or vice versa.

## Open Questions / Known Gaps
- The **Record Payment modal displays several fields with no real logic behind them** (Unpaid Interest, Release Date/Status, From Impound, Other Payments, Lender Fees, Broker Fees) — explicitly called out in a code comment as placeholders matching TMO's layout, pending features that don't exist yet (e.g. task #44's persistent unpaid-interest ledger, investor payout/release tracking).
- **`generateSchedule` and `calculatePayoffQuote`** (amortization domain modules, both fully implemented and unit-tested) are **not called from any page or server action** in `src/app` or `src/server` — there is no visible "view amortization schedule" or "get a payoff quote" UI wired up yet, only the raw domain functions and a couple of one-off migration scripts that reference them.
- **No document upload/preview** — "Attachments" is just a stored external Google Drive URL, not an in-app file store.
- **No page found for creating a brand-new contract from this section** — contract creation appears to live entirely in the separate (largely unbuilt) Onboarding feature; there's no "New Contract" action inside `/contracts` itself.
- Escrow disbursement classification (`classifyDisbursement`) is a simple keyword heuristic on description/payee text (looking for "tax" / "insur"/"hoi"/"homeowner") — it will silently miscategorize anything that doesn't match those substrings as "OTHER," and the code comments confirm the underlying TMO import data was never actually categorized at the source.
