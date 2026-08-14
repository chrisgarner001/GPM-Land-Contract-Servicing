# Bulk Payment

## Purpose
Lets servicing staff record many borrower payments at once from a batch of scanned paper checks, instead of opening each land contract and using its individual "Make Payment" form. It reads each check image, extracts the payer name / amount / check number / date, tries to auto-match the check to the correct active land contract, and — after staff review and correction — records all confirmed payments in one action. This exists to remove manual retyping when a batch of mailed-in checks arrives.

## Users
Internal servicing staff only (this route is only reachable from the internal app sidebar, under "Land Contracts"; it has no borrower- or lender-portal equivalent).

## Core Capabilities
- Upload multiple check images at once (`image/png`, `image/jpeg`, `image/webp`, `image/gif`).
- Extract payer name, amount, check number, and date from each check image using Claude's vision + structured output (`extractCheckData` in `src/server/checkExtraction.ts`, model `claude-opus-4-8`).
- Auto-match each extracted payer name to an `ACTIVE` land contract by comparing it against that contract's `BUYER`/`CO_BUYER` party name(s), using a normalized token-overlap score (case-insensitive, punctuation stripped); the highest-scoring match above a `0.4` threshold is selected.
- Review table where staff can, per check: include/exclude it, correct the extracted amount, set the received date (defaults to today), and pick/override the matched contract from a dropdown of all active contracts.
- Rows with no auto-match are visually flagged (amber row) and require a manual contract selection before they can be recorded.
- Submit all included, matched rows in one action; each becomes a real payment via the same `recordPayment()` path used by the per-contract payment form.
- Running total of the currently included checks' dollar amount, shown live in the UI.
- After submission, a summary message reports how many payments were recorded and lists any failures with their error message.

## Data Touched
- **Reads:** `contracts`, `contractParties`, `parties` (to build the active-contract list and do payer-name matching).
- **Writes (via `recordPayment` → `applyPayment`):** `payments`, `payment_allocations`, and `contracts` (`currentPrincipalBalanceCents`, `nextPaymentDate`, and payoff status/date when a payment pays the contract off).
- **Domain logic used:** `src/domain/ledger/applyPayment.ts` (interest/principal/reserve waterfall), `src/domain/ledger/advanceNextPaymentDate.ts`.
- **Server orchestration used:** `src/server/payments.ts` (`recordPayment`), `src/server/checkExtraction.ts` (`extractCheckData`).

## Key Constraints / Business Rules
- Money is handled as whole cents throughout; the UI's dollar `<input>` converts to cents with `Math.round(value * 100)`.
- Only contracts with `status = "ACTIVE"` are eligible for matching or manual selection.
- Every bulk-recorded payment is submitted with `paymentMethod: "CHECK"` and `referenceNumber` set to the extracted check number — there is no way to record a different payment method from this screen.
- The bulk flow does **not** pass `escrowPortionCents`, `lateFeeCents`, or `chargePaymentCents` to `recordPayment` — every bulk payment goes through the plain interest/principal/reserve waterfall in `applyPayment`, with no escrow split, late-fee application, or charge repayment. (The per-contract payment form supports these; bulk payment does not.)
- `applyPayment`'s reserve rule applies here exactly as elsewhere: if a check's amount is less than the contract's regular scheduled payment amount, the whole deposit is held in `SUSPENSE` (reserve) rather than applied.
- A row is only eligible for submission if `include` is checked, it has a `matchedContractId`, and its amount is greater than 0 (`submitBulkPayments` is only called with rows passing all three).
- `submitBulkPayments` records each payment sequentially in its own call/transaction (via `recordPayment`, which itself wraps its DB writes in one transaction) — there is no single all-or-nothing transaction across the whole batch, so a batch can partially succeed.

## Related Features
- Shares its core payment-recording path (`recordPayment` / `applyPayment`) with the per-contract "Make Payment" flow on the land contract detail page — both are explicitly called out in `src/server/payments.ts` as depending on identical allocation/balance/payoff logic.
- Feeds the same `payments` / `payment_allocations` tables that **Escrow Maintenance** and the per-contract **Escrow Analysis** page read from — but because bulk payments never set an escrow portion, checks recorded here do not update a contract's tracked monthly escrow collection unless that split is added to the bulk flow later.
- Uses the same check-image vision extraction concept referenced (for a different purpose — vendor/lender check register classification) by `src/server/checkClassification.ts`, though that module is not used by this feature.
