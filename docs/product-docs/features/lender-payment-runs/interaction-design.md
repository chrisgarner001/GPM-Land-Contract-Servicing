# Lender Payment Runs — Interaction Design

## Entry Point
`/lenders/print-statements` — the existing "Statements" nav entry under Lenders, currently rendering only "Coming soon." This feature replaces that stub. Recommend leaving the nav label as "Statements" (no IA change) while the page's own heading becomes something accurate to what it now does (e.g. "Lender Payment Run"), with a short explanatory line that statement documents/emailing are a later phase — flagged as an open cosmetic question rather than decided here.

## Primary Flow (staff running a distribution)
1. Staff opens `/lenders/print-statements`. A **Run Date** field defaults to today, and a **Last Sweep** field defaults to `DEFAULT_SWEEP_BASELINE_DATE` (`2026-07-31` as of this writing — see Secondary Flows) — both `?runDate=`/`?sweepBaseline=` query params, consistent with this app's existing query-string-driven filter pattern (Lenders list, Lender Check Register). Changing either and submitting re-runs the computation.
2. For each lender with any ledger history, the page reconstructs their outstanding line items directly (step 3) and sums them live — there is no separately-stored "balance as of run date" read anymore; the header total and the breakdown table are definitionally the same number. Sum `<= 0` → excluded from the list entirely.
3. Each lender's effective floor is whichever is LATER of their last real `DISTRIBUTION` entry's date, or the Last Sweep value. Line items = every `PAYMENT_CREDIT`-type entry dated after that floor through the run date, joined to `sourceContractId` for the LC # and to `sourcePaymentId` for the payment date.
4. Each lender's block shows:
   - Lender name (linking to `/lenders/[lenderId]`, existing pattern).
   - A payment-method radio, **Check** / **ACH**, pre-selected from `parties.preferredPaymentMethod` (defaulting to Check if unset — matches every real distribution to date).
   - A line-item table: **LC #** (linked), **Payment Date**, **Payment Amount** (lender's gross P&I share before fee), **Interest**, **Principal**, **SGMS Service Fee**, **Total**.
   - A per-lender summary row: sum of **Total** across all line items = the check/ACH amount.
5. Staff reviews, optionally flips the radio, and clicks **Process** for that lender (a per-lender action, not a single blanket "Process All" — recommended default, since this creates a real check-numbered/ACH-marked record staff should confirm individually; whether a bulk "Process All" is also wanted is an open question).
6. Processing calls a new Server Action, `processLenderDistributionAction(lenderId, runDate, sweepBaseline, paymentMethod)`:
   - Re-fetches that lender's line items server-side (same floor logic as step 3) rather than trusting client-submitted totals — catches a payment landing between page load and this click.
   - Inserts one `checks` row (`paymentMethod` = `CHECK` with a staff-entered check number, or `ACH` with a synthetic reference like `ACH-{runDate}-{payeeCode}`), plus one `checkLineItems` row per contract represented in that lender's line items (aggregating multiple payments on the same contract into a single line — matching how historical lender checks were always recorded per-contract, not per-payment).
   - Inserts one `lenderLedgerEntries` row, `entryType = 'DISTRIBUTION'`, `transactionDate = runDate` — this becomes that lender's new effective floor going forward, regardless of Last Sweep. Its own `balanceCents` is computed from the TRUE complete running balance (`getLatestLenderBalanceCents`, unaffected by the Last Sweep floor), so other consumers (lender portal, lender detail page) keep seeing accurate complete history.
   - `revalidatePath('/lenders/print-statements')` — the processed lender drops off the list, same "mutation reflects immediately" convention used throughout `/lenders/[lenderId]`.
7. Inline success/error feedback under that lender's block (e.g. "Processed — Check recorded for $1,241.52"), matching the rest of the app's `useActionState` inline-feedback convention — no toast system exists here.

## States & Transitions
- **Empty state**: "No lenders have outstanding activity as of {runDate}."
- **Per-lender pending state**: Process button disables + shows "Processing..." while its action is in flight (existing pattern).
- **Re-visiting after processing**: no separate "already run" flag is needed — a processed lender's balance is already 0, so they naturally don't reappear even if the run date is re-submitted.
- **A lender's line items span more than one payment on the same contract** (multiple payments received since their last sweep): each contributing payment is its own line item for full traceability (LC #, its own payment date, its own P&I split) — they are not merged into a single date-ranged row, only aggregated into one `checkLineItems` row per contract at Process time.

## Secondary Flows / Edge Cases
- **No `preferredPaymentMethod` set**: radio defaults to Check.
- **Last Sweep floor (testing scaffolding, added 2026-08-04)**: real lender payments through July 2026 were already made outside this app via TMO ahead of the eventual data migration/go-live, so the historical-legacy-balance risk originally flagged here is now handled by a `sweepBaseline` floor defaulting to `2026-07-31` — only credits dated after the later of {a lender's last real distribution, this floor} count as outstanding, regardless of how large their true complete history is. At real go-live, after importing fresh TMO data, this default should move to the actual cutover date (`DEFAULT_SWEEP_BASELINE_DATE` in `src/server/lenderPaymentRuns.ts`).
- **Reversed payment**: since `reversePayment` symmetrically reverses the lender credit (this task's prerequisite fix), a payment reversed before its lender distribution runs simply nets to zero and produces no stray line item.
- **Contract with zero active lenders** (funding lapsed/superseded): no credit is generated for that payment in the first place — consistent with `debitActiveLenders`' existing behavior of throwing when there's no active lender, though crediting on a normal payment should probably no-op rather than throw if a contract briefly has no active lender, since a regular payment recording shouldn't fail because of a lender-funding gap. Flagged as a Decision Needed.

## Resolved (as implemented)
- No bulk "Process All" — per-lender Process only.
- Page heading is "Lender Payment Run"; nav label stays "Statements."
- `/lenders/print-checks` left untouched (still a stub) — out of scope.
- `recordPayment` silently produces no lender credit when a contract has no active lender (no throw).
- `checks` was extended with `paymentMethod` rather than a parallel ACH schema; `checkNumber` holds a synthetic reference for ACH rows.

## Open Questions / Known Gaps
- Whether a bulk "Process All" action becomes worth adding once real usage shows per-lender Process is tedious for a business running dozens of lenders every period.
- No per-action auth check on `processLenderDistributionAction` (matches existing sibling-action precedent) — worth revisiting if stricter accountability (e.g. logging which staff member processed a distribution) is wanted later.
- The first real run for most lenders will surface their entire historical balance (only 1 of ~15,139 historical ledger rows was ever a recorded sweep) — worth a deliberate rollout conversation before the first production run, not a silent surprise.
