# Lenders

## Purpose
SGMS services land contracts on behalf of outside investors ("lenders") who fund some or all of a contract's balance. This feature tracks who those lenders are, how much of each contract they own, and the money that flows to them as borrowers pay — a per-lender clearing ledger that accumulates each payment's net share and is periodically swept out via a "Lender Check." It also gives staff a way to manage lender contact/banking details and to preview the lender's own online portal.

## Users
- Internal staff (loan servicers/back-office) — the primary users of everything under `/lenders`.
- Lenders themselves — via a separate borrower-style online portal (`/online-portals/lenders`), which is a read view into the same ledger and funded-contracts data. Staff can impersonate a lender's portal session from the staff UI ("Log In As").

## Core Capabilities
- **List lenders** (`/lenders`): search by name/email, sort by name, see contracts funded, online-portal status (Active/Not Set Up based on whether email + PIN are set), and total net ledger activity (received − paid out) per lender.
- **Add a new lender** (`/lenders/new`): create a party of type BUSINESS or INDIVIDUAL with contact info, mailing address, portal PIN, and optional SSN/TIN and ACH banking details (all in one form).
- **Lender detail page** (`/lenders/[lenderId]`):
  - Edit contact info (name, company, email, phone, mailing address).
  - View/edit sensitive info (SSN/TIN, ACH bank name/routing/account) with masked last-4 display and an explicit "Reveal" action that decrypts on demand.
  - Link a Google Drive documents folder (validated to be an `https://` URL).
  - Add free-text notes, timestamped and attributed to the logged-in staff user.
  - Set a default bank account this lender is normally paid from (from Setup > Bank Accounts).
  - View every land contract this lender currently funds (ownership %, status, principal balance).
  - View the last 25 lender-ledger entries (date, reference, contract, description, net amount) with a running net total.
  - "Log In As" — impersonate the lender's portal session as staff, without needing their PIN.
- **Lender Check Register** (`/lenders/check-register`): a filterable, sortable register of check line items paid to lender payees (date range, payee/code search, land-contract search), defaulting to the last 90 days, capped at 1000 rows.
- **Print Checks** (`/lenders/print-checks`): placeholder page only — renders "Coming soon."
- **Print Statements** (`/lenders/print-statements`): becoming the entry point for **Lender Payment Runs** (`docs/product-docs/features/lender-payment-runs/`) — a run-date-scoped screen for reviewing and processing each lender's outstanding distribution (Check or ACH). See that feature doc for the full design; statement document generation/emailing/portal-posting remain a later phase.

## Data Touched
- `parties` (`src/db/schema/parties.ts`) — the lender's identity, contact info, encrypted SSN/TIN and ACH account, portal PIN, default bank account.
- `contractParties` (`src/db/schema/contracts.ts`) — role `INVESTOR_PAYEE` rows linking a lender party to a contract: `ownershipPercent`, `brokerServicingFeeCents` (flat-dollar only), `fundedAmountCents`, `interestRateAnnual`, `fundingDate`/`endDate` (funding-history periods; "current" = `endDate IS NULL AND ownershipPercent > 0`).
- `lenderLedgerEntries` (`src/db/schema/lending.ts`) — the per-lender clearing ledger: `amountReceivedCents`/`amountPaidOutCents`, running `balanceCents`, `sourceContractId` (null for outbound "Lender Check" sweep rows).
- `partyNotes` (`src/db/schema/notes.ts`) — staff notes on the lender.
- `checks` / `checkLineItems` (`src/db/schema/checks.ts`) — read by the Check Register, filtered to lender payees via `isLenderPayeeSql`.
- `bankAccounts` (`src/db/schema/setup.ts`) — default bank account options.
- Domain: `src/domain/lending/calculateLenderShare.ts` — computes a lender's net credit for a single borrower payment (ownership share of the payment minus a flat broker servicing fee). Now called from `src/server/lenderLedger.ts`'s `creditLendersForPayment`, wired into `recordPayment` as of **Lender Payment Runs** (`docs/product-docs/features/lender-payment-runs/`) — every regular payment credits its contract's active lender(s) live.
- `parties.preferredPaymentMethod` (`CHECK` | `ACH`, nullable) — added for Lender Payment Runs; settable from `/lenders/new` and the lender detail page's Default Bank Account section.
- Server: `src/server/lenderLedger.ts` — `getActiveLenders`, `getLatestLenderBalanceCents`, and `debitActiveLenders`/`creditActiveLenders`, which post proportional ledger entries when a vendor invoice is charged to the lender (see Vendors feature) and when the borrower later repays that charge.

## Key Constraints / Business Rules
- Money is stored as whole cents everywhere; `decimal.js` is used only for the proportional ownership-percent split, rounded half-up to the nearest cent (`splitProportionally` in `lenderLedger.ts`; `calculateLenderShare.ts`).
- The broker servicing fee is always a flat dollar amount — the code explicitly notes this business never uses a percentage or note-rate-spread fee.
- "Active lender" is defined consistently everywhere (Lenders list, lender detail, New Invoice, portal): `contractParties.role = 'INVESTOR_PAYEE' AND ownershipPercent > 0 AND endDate IS NULL`.
- SSN/TIN and ACH account number are AES-256-GCM encrypted at rest (`src/lib/encryption.ts`); only last-4 is stored unencrypted for list/display. Updating sensitive info leaves the existing encrypted value untouched if the field is submitted blank — it never silently clears a value.
- Routing numbers are treated as public (not encrypted) since they're printed on checks; only the account number is sensitive.
- `debitActiveLenders` throws if a contract has no active lender when "Charge Lender" is attempted on a vendor invoice.
- The Check Register classifies a check as a lender payment via `isLenderPayeeSql` (`src/server/checkClassification.ts`), matching `checks.payeeName` against `INVESTOR_PAYEE` party display names, with a special-case fallback for "ETC Custodian FBO (...)" sub-accounts matched by payee code.
- "Log In As" resolves every party sharing the same email+PIN combination (e.g. one analyst managing several investor LLCs) so the impersonated portal session matches what that lender's real login would show, including the portfolio picker.

## Related Features
- **Vendors** — a vendor invoice can be posted in "Charge Lender" mode, which debits the contract's active lender(s) directly via `debitActiveLenders` instead of touching escrow; the borrower's later repayment credits the lender back via `creditActiveLenders`.
- **Contracts** — `contractParties` (INVESTOR_PAYEE rows) is the join between lenders and the land contracts they fund; contract detail pages likely surface a "Funding" history built on the same `fundingDate`/`endDate` periods.
- **Check printing / Check Register** — the lender check register reads the same `checks`/`checkLineItems` tables as the vendor check register, split by payee classification.
- **Online Portals (lenders)** — `/online-portals/lenders` is the lender-facing read view of the same funded-contracts and ledger data shown on the staff lender detail page.
- **Lender Payment Runs** (`docs/product-docs/features/lender-payment-runs/`) — child feature living at `/lenders/print-statements`; the first live writer of `checks`/`checkLineItems` and the first thing to actually call `calculateLenderShare`/credit `lenderLedgerEntries` from a regular borrower payment.
