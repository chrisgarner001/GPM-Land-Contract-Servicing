# Lender Payment Runs

**Status: Phase 1 implemented.** `/lenders/print-statements` is live (heading "Lender Payment Run"). The decisions below reflect what shipped, not just what was planned.

## Purpose
Gives staff a repeatable, date-scoped way to determine which lenders are currently owed a distribution for payments collected on the contracts they fund, review that amount broken down to the contract/payment level, choose Check or ACH per lender, and produce the resulting distribution — sweeping that lender's clearing ledger balance to zero.

This is **Phase 1** of the eventual "Lender Statements" workflow the business runs monthly/periodically. Producing a human-readable statement document, emailing it to the lender, and posting it to the lender's online portal are explicitly **out of scope** for this phase — see Related Features.

## Users
Internal staff only (back-office/accounting role). No lender-facing or borrower-facing surface is part of this feature.

## Core Capabilities (Phase 1)
- **Run Date entry** — defaults to today, staff can set it to any date to reproduce what a run would have looked like as of that date (e.g. running a few days late, or re-checking a prior period).
- **Eligible lender list** — every lender (`parties` with an `INVESTOR_PAYEE` history) whose ledger balance is positive as of the run date. A lender with nothing outstanding simply doesn't appear.
- **Line-item breakdown per lender** — one row per (contract, underlying borrower payment) contributing to that lender's outstanding balance: LC #, payment date, the lender's gross share of that payment's principal+interest, the interest/principal split of that share, the flat SGMS servicing fee, and the net total.
- **Payment method selection** — a Check/ACH choice per lender, pre-filled from a stored per-lender preference, overridable for this run only.
- **Process action** — per lender, produces the distribution record (a check row, or an ACH record) and records a real distribution for that lender's outstanding activity as of the run date.
- **Last Sweep floor (testing scaffolding)** — a second date, editable alongside Run Date, defaulting to `2026-07-31` (`DEFAULT_SWEEP_BASELINE_DATE` in `src/server/lenderPaymentRuns.ts`). Only credits dated *after* the later of {a lender's last real distribution, this floor} count as outstanding. Added because real lender payments through July 2026 were already made outside this app (via TMO) ahead of the eventual data migration — this keeps that already-paid historical activity out of the run without touching any underlying rows. At real go-live, after importing fresh TMO data, this should move to the actual cutover date. It does not affect the true, complete running balance stored in `lenderLedgerEntries.balanceCents` (still read as-is by the lender portal and lender detail page) — it only bounds what *this* screen treats as outstanding-to-distribute.

## Explicitly Out of Scope (Phase 1)
- Generating a printable/emailable statement document.
- Emailing the statement to the lender.
- Posting the statement to `/online-portals/lenders`.
- Any real bank/ACH transfer integration — "Process ACH" is record-keeping only (see Key Constraints). No such integration exists anywhere in this codebase today (no Plaid, no NACHA export, nothing) — staff still originate the actual transfer through the bank's own online banking, using this run as their worksheet, the same way "Print Check" today still requires a human to physically print and mail the check.

These become a follow-up feature once this foundation exists.

## Foundational Fix Bundled Into This Task (shipped)
Confirmed during scoping: **regular borrower payments did not credit any lender's ledger.** `src/domain/lending/calculateLenderShare.ts` was fully implemented and unit-tested but had no call site outside its own test — `recordPayment` (`src/server/payments.ts`) only called `creditActiveLenders` for charge-repayments (the Vendors "Charge Lender" flow), never for a contract's regular scheduled payment.

`recordPayment` now calls the new `creditLendersForPayment` (`src/server/lenderLedger.ts`) unconditionally on every payment, computed from that payment's **interest + principal allocations only** (excluding escrow/late-fee/other components, which aren't lender-owned capital and already flow entirely through `trustLedgerEntries` to tax/insurance vendors). `reversePayment` calls the symmetric `reverseLenderCreditsForPayment` to back the credit out. A contract with no active lender at payment time produces no credit and no error — recording a payment must never fail because of a lender-funding gap.

**Confirmed at migration time (2026-08-04):** across ~15,139 historical `lenderLedgerEntries` rows, only **one** was ever recorded as a `DISTRIBUTION` (sweep). This means nearly every lender's entire historical balance will appear as "outstanding" the first time a run is performed for them — a real rollout consideration, not a hypothetical one. See Key Constraints.

## Data Touched
- `parties` — lender identity, ACH banking fields (`achBankName`/`achRoutingNumber`/`achAccountNumberEncrypted`, already exist), `defaultBankAccountId`. `preferredPaymentMethod` enum (`CHECK` | `ACH`), nullable, lender-scoped like `portalPin` — settable from both `/lenders/new` and `/lenders/[lenderId]` (Default Bank Account section).
- `contractParties` — `ownershipPercent`, `brokerServicingFeeCents` (flat dollar) for the active `INVESTOR_PAYEE` funding.
- `payments` / `paymentAllocations` — source of the `INTEREST`/`PRINCIPAL` amounts a lender's share is computed from.
- `lenderLedgerEntries` — credited by every regular payment (`entryType = 'PAYMENT_CREDIT'`), swept by this feature's Process action (`entryType = 'DISTRIBUTION'`). `entryType` enum (`PAYMENT_CREDIT` | `CHARGE_CREDIT` | `CHARGE_DEBIT` | `DISTRIBUTION`) reliably distinguishes sweep rows from credit rows — historical rows were backfilled by migration from existing column signs (sourceContractId nullability + which amount column is set), not free-text description matching. Also gained `sourcePaymentId` (FK → `payments.id`) and an immutable `interestCents`/`principalCents`/`servicingFeeCents` snapshot per `PAYMENT_CREDIT` row, populated at credit time — the Run screen reads these directly rather than recomputing a historical credit's breakdown against possibly-since-changed `contractParties` data.
- `checks` / `checkLineItems` — first live writer: this is the first place in the app that ever inserts into these tables (previously read-only, populated entirely by historical import). `paymentMethod` enum (`CHECK` | `ACH`) on `checks`, default `CHECK` (so historical rows classify with zero backfill); `checkNumber` holds a synthetic reference for ACH rows (e.g. `ACH-2026-08-04-{payeeCode}`).
- Domain: `src/domain/lending/calculateLenderShare.ts` — now has real call sites in `src/server/lenderLedger.ts`.
- Server: `src/server/lenderLedger.ts` — `creditLendersForPayment`/`reverseLenderCreditsForPayment` (new); `src/server/payments.ts` — `recordPayment`/`reversePayment` wired to call them; `src/server/lenderPaymentRuns.ts` (new) — `getLendersWithOutstandingBalance`, `getLineItemsSinceLastDistribution`, `processLenderDistribution`.

## Key Constraints / Business Rules
- Lender share is computed on **principal + interest only**, never on escrow, late fees, or other charge components of a payment.
- The SGMS servicing fee is always a flat dollar amount (existing rule, `contractParties.brokerServicingFeeCents`) — deducted before crediting the lender, same math as `calculateLenderShare` already implements.
- "Process ACH" performs no real funds transfer — it is a record-keeping action symmetric with "Print Check" (produces a system-of-record distribution row; a human still originates the real transfer or print job outside this app).
- The run date, not "now," anchors both eligibility (which lenders have a positive balance) and the sweep's transaction date — a backdated or future run date must produce the same list a same-dated run would have.
- A lender who has never been "swept" through this app (i.e., their balance is 100% legacy/imported) will show their full accumulated historical balance the first time a run is performed for them — confirmed as a near-universal case at migration time (see above), not a rare edge case. The Run screen caps displayed line items at 500 per lender (with a "more exist" note) as a page-weight safeguard; it does not hide or alter the actual outstanding total.
- No bulk "Process All" action exists — Process is per-lender only, by design, since it produces a real check-numbered/ACH-marked record staff should confirm individually.
- `processLenderDistributionAction` has no per-action auth check, matching every sibling action in `src/app/lenders/[lenderId]/actions.ts` — protection is the page-level staff gate in `proxy.ts`, not a per-action check.

## Related Features
- **Lenders** (parent feature, `docs/product-docs/features/lenders/`) — this feature lives under the existing "Statements" nav entry (`/lenders/print-statements`) and depends on `contractParties`/`lenderLedgerEntries` documented there.
- **Vendors** — "Charge Lender"/"Pay Charges" is currently the *only* other place `lenderLedgerEntries` gets written; this feature is the second.
- **Online Portals (lenders)** — the eventual home for posting a statement once that follow-up phase is scoped; untouched by this phase.
- **Follow-up feature (not yet scoped): Lender Statements** — statement document generation, emailing (likely following the existing `partyEmailDrafts`/Gmail-draft-for-review pattern used by Borrowers' `ComposeEmailForm`, since there's no outbound-email-sending integration anywhere in this codebase), and portal posting.
