# Contracts

## Purpose
The Contracts feature is the core servicing workspace for a single land contract (owner-financed loan). It is where staff view a loan's current status and balances, take a payment, reverse a mistaken payment, run an escrow/impound analysis, track lender funding history, and record legal/foreclosure process milestones. Every other feature in the app (borrowers, lenders, escrow maintenance, tax-bill processing) ultimately hangs off a contract record.

## Users
Internal staff only (Supabase-authenticated, gated by `src/proxy.ts` middleware). There is no borrower- or lender-portal view of this exact set of pages — the separate borrower/lender portals (`/online-portals/...`, not explored in this pass) present a different, more limited view of the same underlying data.

## Core Capabilities
- **Browse/filter the loan book** (`/contracts`): sortable, searchable table of all contracts (account, borrower, lender, property, status, rate, payment, balance, maturity, next due date, days past due). Filters: active vs. all (including paid off), free-text search, lender dropdown, and one-click delinquency buckets (30+/60+/90+ days past due, mutually exclusive tiers).
- **Contract overview** (`/contracts/[contractId]`): loan terms, balances (principal, late fee, balloon if applicable, reserve, escrow, unpaid charges), key dates, borrower contact/portal credentials, a "Make a Payment" panel with live amount-due calculation, the 5 most recent payments with a full P&I/escrow/charges/late-fee breakdown, the 5 most recent escrow/trust-ledger entries, contract notes, and a Google Drive attachments link.
- **Record a payment**: staff open a modal (`RecordPaymentModal`), see a TMO-style "loan information" summary, enter amount/method/reference/date, optionally draw down an existing reserve balance, optionally override the late fee or pay down outstanding charges, and see a live client-side preview of how the deposit will be allocated (principal/interest/escrow/late fee/charges/reserve) before submitting.
- **Reverse a payment**: only the single most recent CLEARED, non-reversal payment on a contract can be reversed (confirm dialog required); reversal restores the principal balance, regresses the next-payment-date, and reopens PAID_OFF status if that payment had paid the loan off.
- **View full payment history** (`/contracts/[contractId]/history`): every payment, oldest first, with per-allocation-type breakdown.
- **View the trust ledger** (`/contracts/[contractId]/trust-ledger`): full escrow/impound sub-ledger (deposits, disbursements, running balance), with Reserve/Impound/Unclassified counts.
- **Run an escrow analysis** (`/contracts/[contractId]/escrow-analysis`): view trailing-12-month tax and insurance disbursements (auto-classified from payee/description text), current monthly escrow collection and balance, then run a new analysis (reason/trigger, projected annual tax + insurance, current balance/payment, cushion %, projection period) that computes a shortage/surplus and a new recommended monthly escrow payment, and saves it to history.
- **View/manage lender funding** (`/contracts/[contractId]/funding`): see current and historical funding entries (lender, date, amount, rate); add a new funding entry for an existing or brand-new lender party, which automatically closes out the previous active lender's share as of the new funding date.
- **View contract terms** (`/contracts/[contractId]/terms`): read-only summary of general terms, dates, balloon terms (if any), penalties, and all buyers/lenders and their ownership percentages.
- **Update legal/foreclosure process status** (`StatusCard` on the overview page): set legal process stage (Court/Foreclosed/Forfeited) and forfeiture notice/court hearing/judgment/eviction dates; a delinquency badge (30+/60+/90+ days) is computed and shown automatically for ACTIVE contracts.
- **Add contract notes** and **link a Google Drive attachments folder**.

## Data Touched
- `src/db/schema/contracts.ts` — `contracts` (loan terms, balances, status, legal-process dates, portal credentials, Drive link) and `contractParties` (buyers, co-buyers, and INVESTOR_PAYEE/lender funding rows with ownership %, funded amount, rate, funding/end dates, broker servicing fee).
- `src/db/schema/parties.ts` — `parties` (buyer/lender contact info) and `properties` (address).
- `src/db/schema/payments.ts` — `payments` and `paymentAllocations` (the append-only payment ledger).
- `src/db/schema/escrow.ts` — `trustLedgerEntries` (escrow/impound sub-ledger) and `escrowAnalyses` (saved analysis runs).
- `src/db/schema/charges.ts` — `contractCharges` (outstanding charges paid down via the payment modal's "Pay Charges" field).
- `src/db/schema/notes.ts` — `contractNotes`.
- `src/domain/ledger/applyPayment.ts`, `calculateAmountDue.ts`, `advanceNextPaymentDate.ts` — payment allocation and due-amount/late-fee logic.
- `src/domain/escrow/runEscrowAnalysis.ts`, `classifyDisbursement.ts` — escrow analysis math and tax/insurance classification heuristic.
- `src/server/payments.ts` — `recordPayment`/`reversePayment` orchestration (transactional, updates `contracts.currentPrincipalBalanceCents`/`nextPaymentDate`/`status`).
- `src/server/funding.ts` — `addLenderFunding`/`getExistingLenderOptions`.

## Key Constraints / Business Rules
- **Money is always integer cents** at rest and at API boundaries; `decimal.js` is used only for the rate/percentage math inside `applyPayment`, `calculateAmountDue`, and `runEscrowAnalysis`.
- **Partial payments are held, not applied**: if a deposit (plus any reserve being drawn) doesn't cover the regular payment + late fee, the entire amount is recorded as a `SUSPENSE` allocation ("held in reserve") — no principal/interest/escrow is touched until enough accumulates.
- **Reserve never silently combines with a deposit** — staff must explicitly check "Apply Reserve."
- **Payment reversal is restricted to the single most recent CLEARED, non-reversal payment** on the contract, to avoid corrupting later payments' interest/principal math; reversals are appended (never delete/mutate the original row) with negated allocations.
- **Escrow analysis cushion is a flat 5% policy** (not RESPA's 1/6 rule) — land contracts aren't subject to RESPA per the code comments.
- **Escrow balance is TMO's own authoritative running balance** (`trustLedgerEntries.balanceCents`, most recent row), not recomputed from collected-vs-disbursed sums, because historical per-payment escrow data is known to be incomplete.
- **Only ACTIVE contracts are flagged as delinquent** — a paid-off/cancelled contract with a stale past `nextPaymentDate` is not shaded/badged as past due.
- **Adding new lender funding supersedes the current lender(s)** going forward (closes out prior ownershipPercent to 0 + stamps endDate) rather than deleting history.
- Several fields shown in the Record Payment modal (Unpaid Interest, Release Date/Status, From Impound, Other Payments, Lender/Broker Fees) are **display-only placeholders with no backing logic yet** — explicitly called out in code comments as pending future work.

## Related Features
- **Borrowers** — the buyer-side party record linked from the contract header and overview page.
- **Lenders / Funding** — investor-payee parties and their share of a contract, plus lender-facing ledger crediting (`src/server/lenderLedger.ts`, referenced from charge repayments).
- **Escrow Maintenance** (portfolio-wide, not explored in this pass) — shares the same disbursement classification and trust-ledger tiebreaker logic as this feature's Escrow Analysis page.
- **Onboarding** — the (currently unbuilt) entry point that would create new contract records for this feature to manage.
- **Charges/Vendors** (`src/db/schema/charges.ts`, `vendors.ts`) — outstanding contract charges paid down via the payment modal.
