# Vendors

## Purpose
Vendors are the third parties SGMS pays out of a borrower's escrow/trust balance on the borrower's behalf — tax authorities, insurance carriers, title companies, attorneys, etc. This feature manages the vendor directory and lets staff manually key in a new invoice, choosing whether it's paid from the contract's escrow balance or charged directly to the contract's funding lender. It also provides register/statement views over historical and current vendor disbursements.

## Users
Internal staff only (loan servicers/back-office). There is no vendor-facing portal in this codebase — vendors are paid entities, not app users.

## Core Capabilities
- **List vendors** (`/vendors`): every vendor with its account code, city/state/zip, count of disbursement transactions, and lifetime total disbursed (summed across `vendorDisbursements`).
- **Add a new vendor** (`/vendors/new`): create a vendor with a required unique account code, display name, optional reference/policy line, address, and city/state/zip. Rejects duplicate account codes.
- **Vendor detail page** (`/vendors/[vendorId]`): vendor identity/address, a "New Invoice" shortcut pre-filled with this vendor, a settable default bank account, and the full history of disbursements against this vendor (date, reference, contract, amount, servicing fee, interest/principal distribution, charges, other), each linking through to its contract.
- **New Invoice** (`/vendors/new-invoice`, optionally `?vendorId=`): a single form that can:
  - Create a brand-new vendor inline (auto-generates a unique account code from the name) or select an existing one.
  - Pick a land contract (shows buyer name, current escrow balance, and current lender(s) with ownership % inline as context).
  - Choose "Apply To": **Escrow Balance** (deduct from the contract's trust/escrow ledger) or **Charge Lender** (post a borrower-owed charge and immediately debit the contract's active lender(s), to be repaid later via the borrower's regular payments).
  - Enter amount, due date, payment method (Check/ACH/Paid Online), a free-text reference/account number, and an optional GL code (grouped by GL code type in the dropdown).
  - Live preview: for Escrow mode, shows balance-before/after (highlighted red if it would go negative); for Charge Lender mode, lists exactly which lender(s) and ownership % will be debited, or blocks submission if there is no active lender.
- **Vendor Check Register** (`/vendors/check-register`): filterable/sortable register of check line items paid to vendor payees (date range, payee/code, land-contract search), last-90-days default, capped at 1000 rows.
- **Statements** (`/vendors/statements`): placeholder page only — renders "Coming soon."

## Data Touched
- `vendors` / `vendorDisbursements` (`src/db/schema/vendors.ts`) — vendor identity/account code and every disbursement line (amount, GL code, payment method, servicing fee/interest/principal/charges/other breakdown, default bank account).
- `trustLedgerEntries` (`src/db/schema/escrow.ts`) — the contract's escrow/trust ledger; a matching row is written whenever an invoice is applied in Escrow mode, so the vendor's own ledger and the contract's trust ledger stay in agreement.
- `contractCharges` (`src/db/schema/charges.ts`) — a borrower-owed charge row created when an invoice is applied in Charge Lender mode; repaid later through "Pay Charges" on a regular payment (`src/server/payments.ts`).
- `lenderLedgerEntries` (`src/db/schema/lending.ts`, via `src/server/lenderLedger.ts`) — debited proportionally across the contract's currently active lender(s) when Charge Lender mode is used.
- `checks` / `checkLineItems` (`src/db/schema/checks.ts`) — read by the Vendor Check Register, filtered to non-lender payees via `NOT isLenderPayeeSql`.
- `glCodes`, `bankAccounts` (`src/db/schema/setup.ts`) — GL code dropdown and default/selectable bank accounts.
- Server: `src/server/vendorInvoices.ts` (`createVendorInvoice`, `createVendor`), `src/server/checkClassification.ts` (`isLenderPayeeSql`, shared with Lenders), `src/domain/escrow/classifyDisbursement.ts` (buckets a disbursement's description/vendor into TAX/INSURANCE/OTHER for `trustLedgerEntries.voucherType`).
- `src/server/checkExtraction.ts` uses the Anthropic SDK (`@anthropic-ai/sdk`, vision + structured JSON-schema output) to read payer name/amount/check number/date off a scanned check image — but it is wired into **`src/app/bulk-payment/actions.ts`** (incoming borrower payment checks), not into any page under `src/app/vendors/`. It is unrelated to outbound vendor check printing.

## Key Constraints / Business Rules
- Money is stored as whole cents everywhere; the invoice form converts a dollar-string input (`amount`) to cents with `Math.round(Number(amountDollars) * 100)` and rejects non-finite or non-positive results.
- Vendor account codes are unique and enforced both at the DB level (`vendorAccountCode` unique index) and explicitly checked in `addVendor`/`createVendor` before insert, returning a friendly error rather than a DB constraint failure.
- `createVendor` (used for the "New Vendor" inline path on the invoice form) auto-generates an account code from the display name (uppercased, alphanumeric-only, truncated to 10 chars, falling back to `"VENDOR"` if empty) and appends a numeric suffix on collision.
- There is deliberately **no unique constraint** on `(vendorId, contractId, transactionDate, reference)` in `vendorDisbursements` — a prior version had one and it silently dropped ~2,935 real transactions via `onConflictDoNothing` before the bug was caught; a single check can legitimately carry multiple distinct line items sharing all four fields (partial charges, corrections/reversals).
- Charge Lender mode requires at least one active lender (`contractParties.role = 'INVESTOR_PAYEE'`, `ownershipPercent > 0`, `endDate IS NULL`); `debitActiveLenders` throws a descriptive error if none exists, and the client-side form pre-emptively disables Save in that case.
- Invoice creation is transactional: both modes wrap their multi-table writes (`vendorDisbursements` + either `trustLedgerEntries`, or `contractCharges` + `debitActiveLenders`) in a single `db.transaction`.
- No pending/unpaid invoice state exists yet — every New Invoice submission is immediately posted as a completed disbursement, mirroring how the legacy TMO import represented vendor payments.
- The Check Register (both vendor and lender variants) classifies rows via the same `isLenderPayeeSql` predicate so the two pages are guaranteed to partition every check line item consistently, with no double-counting or gaps for the disambiguated "ETC Custodian FBO" sub-account payees.

## Related Features
- **Lenders** — Charge Lender mode on a vendor invoice is the only code path that currently posts to `lenderLedgerEntries` (via `debitActiveLenders`/`creditActiveLenders`); the Lender Check Register is the sibling view of the same `checks`/`checkLineItems` data.
- **Escrow / Trust Ledger** (`trustLedgerEntries`, `escrow-analysis`, escrow-maintenance pages implied elsewhere in the app) — Escrow-mode invoices post directly into the contract's trust ledger and must agree with whatever balance those pages display.
- **Contract Charges / Payments** (`src/server/payments.ts`) — a Charge-Lender invoice becomes a `contractCharges` row that is later paid down through "Pay Charges" during a normal borrower payment, which is presumably where `creditActiveLenders` gets triggered to pay the lender back.
- **Bulk Payment** (`src/app/bulk-payment`) — consumes `src/server/checkExtraction.ts`'s AI check-reading for incoming borrower checks; not part of the Vendors feature itself but shares the same "checks" domain vocabulary.
