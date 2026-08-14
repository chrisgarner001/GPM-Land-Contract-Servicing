# Lenders — Interaction Design

## Entry Points
- `/lenders` — main list page, linked from wherever the app's primary nav lives.
- `/lenders/new` — "Add New Lender" (linked presumably from the list page toolbar, though the list page itself in the current code doesn't render an obvious "Add Lender" button — see Open Questions).
- `/lenders/[lenderId]` — clicking a lender's name from the list.
- `/lenders/check-register` — Lender Check Register.
- `/lenders/print-checks`, `/lenders/print-statements` — stub pages.
- `/online-portals/lenders` — the lender-facing portal (separate from staff UI), reachable directly by a lender logging in with email+PIN, or by staff clicking "Log In As" on the list page.

## Primary Flow (staff reviewing/managing a lender)
1. Staff opens `/lenders`. Server component `getLenders()` joins `parties` to `contractParties` (role `INVESTOR_PAYEE`, `ownershipPercent > 0`) to count contracts funded, and separately sums `lenderLedgerEntries.amountReceivedCents`/`amountPaidOutCents` per lender for a "Total Activity" column.
2. Staff can type into the search box (`q`) and submit (GET form) to filter by name/email substring, or click the "Lender" column header to toggle sort direction (`dir=asc|desc`) — both are plain query-string driven, no client state.
3. Clicking a lender's name navigates to `/lenders/[lenderId]`, which loads the party record, its bank account options, its currently-funded contracts (same active-lender filter as the list page), its 25 most recent `lenderLedgerEntries` (newest first), and its notes.
4. Each editable section is its own client component wrapping a server action via `useActionState`:
   - `ContactInfoSection` → `updateLenderContact` — updates name/company/email/phone/address fields, always overwriting (blank clears).
   - `SensitiveInfoSection` → `updateLenderSensitiveInfo` — SSN/TIN and ACH account number are re-encrypted only if a new value is typed; bank name/routing always overwrite. A "Reveal" button per field calls `revealLenderTaxId`/`revealLenderAchAccount` (server actions that decrypt on demand) and toggles between masked (`••••1234`) and plaintext display.
   - `DocumentsSection` → `updateLenderDriveFolder` — validates the URL starts with `https://` before saving; rejects with an inline error otherwise.
   - `PartyNotesSection` → `addLenderNote` — requires non-empty body; attributes the note to the current Supabase-authenticated user's email.
   - `DefaultBankAccountSection` → `updateLenderDefaultBankAccount` — a plain select bound to `bankAccounts`.
5. Every successful mutation calls `revalidatePath('/lenders/[lenderId]')` so the page reflects the change without a full reload (React Server Components refetch on next navigation/action).
6. From the list page, clicking "Log In As" next to an "Active" lender (one with both email and PIN set) submits `logInAsLenderAction`, which resolves all party IDs sharing that lender's email+PIN, creates a lender portal session cookie/token, and redirects staff into `/online-portals/lenders?as=[lenderId]` to preview exactly what that lender would see.

## States & Transitions
- **List page empty state**: not explicitly handled — if `rows` is empty the table simply renders zero `<tr>`s; the "X of Y lenders" count still displays correctly (`0 of 0`).
- **Detail page missing lender**: `if (!lender) return null;` — renders a blank page with no 404, no error message, no redirect. This is a real gap (see Open Questions).
- **Portal status badge**: computed inline from `email && portalPin` — "Active" (green) vs "Not Set Up" (gray), no separate DB flag.
- **Sensitive field reveal**: local component state (`loading`, `revealed`) — toggles between masked and plaintext without a page reload; re-clicking "Hide" just clears local state (does not re-encrypt or re-fetch).
- **Form pending state**: every form disables its submit button and shows "Saving..." while its `useActionState` action is in flight.
- **Success/error feedback**: each section shows inline text (`state.success` in emerald, `state.error` in red) directly under/beside its form; there's no toast/snackbar system evident.
- **Ledger empty state**: the Recent Ledger Activity table explicitly renders "No ledger activity recorded." across a colspan row when there are zero entries.
- **Add Lender validation**: only `displayName` is required client- and server-side; every other field (including SSN/TIN and ACH info) is optional. Type toggling (Business/Individual) changes which fields render but doesn't otherwise change validation.

## Secondary Flows / Edge Cases
- **Lender Check Register** (`/lenders/check-register`): defaults to the last 90 days when no filter query params are present at all; once any filter param (including "Show All") is present, the date bounds become fully open-ended unless explicitly set. Supports column-header sorting (date, check #, payee, land contract, amount) with a persistent secondary sort by check number descending. Results capped at 1000 rows with an inline note to narrow filters. Rows lacking a matched `contractId` still display the raw `loanAccountRaw` text so unreconciled historical data isn't silently hidden.
- **Print Checks / Print Statements**: both are unimplemented stub pages ("Coming soon.") — no form, no data, no server action wired up yet.
- **Charge Lender path (originates in Vendors, lands here)**: posting a vendor invoice in "Charge Lender" mode calls `debitActiveLenders`, which throws if the contract currently has zero active lenders — this surfaces as an error on the New Invoice form, not on any lenders page, but it directly affects a lender's ledger balance.
- **Funding history / multiple lenders per contract**: `contractParties` deliberately has no unique constraint on (contract, party, role) so a lender can fund the same contract again in a later period after being superseded — the lender detail page only shows *currently* active fundings (`endDate IS NULL`), so a lender's historical (superseded) funding periods are not visible anywhere in this feature's UI.

## Open Questions / Known Gaps
- **`calculateLenderShare` was unused in production code — resolved.** Confirmed during Lender Payment Runs scoping: `recordPayment` never credited `lenderLedgerEntries` for regular payments (only `debitActiveLenders`/`creditActiveLenders` via the Vendors "Charge Lender" flow did). Wiring this up is now the foundational fix bundled into `docs/product-docs/features/lender-payment-runs/` — see that feature doc.
- **No "Add Lender" entry point visible from the list page.** `/lenders/new` exists and is fully built, but `src/app/lenders/page.tsx` doesn't render a link/button to it — worth confirming whether it's reachable only via direct URL or top-level nav not covered by this review.
- **Missing lender detail page fails silently.** `LenderDetailPage` returns `null` for an unknown `lenderId` instead of calling `notFound()` or showing an error state.
- **Print Checks is unbuilt.** Print Statements is being replaced by Lender Payment Runs (see above); Print Checks remains an open "Coming soon" stub — whether it should be deprecated/merged now that Payment Runs produces lender checks is an open question tracked in that feature's interaction design.
- **"Reveal" endpoints have no visible audit trail.** `revealLenderTaxId`/`revealLenderAchAccount` decrypt and return sensitive data to the client with no apparent logging of who revealed what, when.
