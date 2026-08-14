# Vendors — Interaction Design

## Entry Points
- `/vendors` — main vendor list.
- `/vendors/new` — "Add New Vendor" (linked from `/vendors` page's header area — note: the current `page.tsx` for `/vendors` does not itself render a visible "Add Vendor" link; see Open Questions).
- `/vendors/[vendorId]` — clicking a vendor name from the list.
- `/vendors/new-invoice`, optionally `?vendorId=<id>` — reached via the "New Invoice" button on a vendor's detail page (pre-selects that vendor), or presumably from a contract's own page (not reviewed here).
- `/vendors/check-register` — Vendor Check Register.
- `/vendors/statements` — stub page.

## Primary Flow (staff recording a vendor invoice)
1. Staff lands on `/vendors/new-invoice`. Server component loads three option sets in parallel: vendor list, GL code list, and a per-contract summary (contract number, buyer name, current escrow balance from the latest `trustLedgerEntries` row, and current active lender(s) with ownership %).
2. Staff chooses **Existing Vendor** (select dropdown) or **New Vendor** (free-text name, created inline on submit via `createVendor`).
3. Staff picks a **Land Contract** from a dropdown showing contract number + buyer name. Selecting a contract updates client-side derived state (`selectedContract`) used for the live preview panels below.
4. Staff picks **Apply To**: Escrow Balance (default) or Charge Lender. Switching this radio swaps which preview panel renders.
5. Staff enters Amount ($), Due Date (defaults to today), Payment Method (Check/ACH/Paid Online, defaults Check), an optional Reference/Account Number, and an optional GL Code (grouped by type via `GL_CODE_TYPE_LABELS`).
6. **Live preview**:
   - Escrow mode: shows "Current Escrow Balance" and "Balance After Invoice" (current − amount), turning the after-balance red if it would go negative. This is purely a client-side warning — nothing blocks submission on a negative balance.
   - Charge Lender mode: lists every currently active lender on the selected contract with their ownership %, or shows an amber warning "No active lender is currently funding this contract — Charge Lender isn't available" and disables the Save button entirely if there are none.
7. On submit, `createInvoiceAction` parses/validates form fields (contract required, amount must parse to a positive integer of cents, due date required), resolves or creates the vendor, then calls `createVendorInvoice` in `src/server/vendorInvoices.ts`:
   - **Escrow mode**: looks up the prior trust-ledger balance for the contract, classifies the disbursement (`classifyDisbursement`) into TAX/HOMEOWNERS_INSURANCE/OTHER for `voucherType`, and in one transaction inserts a `vendorDisbursements` row and a `trustLedgerEntries` row (new balance = prior − amount).
   - **Charge Lender mode**: in one transaction, inserts a `vendorDisbursements` row, inserts a `contractCharges` row (full amount owed, `remainingCents` = amount, tagged to the vendor), and calls `debitActiveLenders` to proportionally debit every active lender's ledger balance.
8. On success, the action revalidates the contract page, its escrow-analysis and trust-ledger sub-pages, `/escrow-maintenance`, `/vendors`, the specific vendor page, and `/lenders` (since Charge Lender mode affects lender ledgers) — then shows a mode-specific success message inline on the form.
9. On failure (e.g. `debitActiveLenders` throwing because there's no active lender, or a thrown DB error), the action returns `{ error: message }` and the form re-renders with the raw error text shown in red — the form values are preserved because this is a client component holding its own state, not a full navigation.

## States & Transitions
- **Vendor list empty state**: not explicitly handled — zero rows renders an empty table with "0 vendors" in the summary line.
- **Vendor detail missing vendor**: `if (!vendor) return null;` — same silent-blank-page behavior as the Lenders feature; no `notFound()` call.
- **New Invoice — Charge Lender with zero active lenders**: the Save button is disabled client-side (`disabled={pending || (applyMode === "CHARGE_LENDER" && !!selectedContract && selectedContract.currentLenders.length === 0)}`), and even if bypassed, the server-side `debitActiveLenders` throws and surfaces as a form error — defense in depth.
- **Duplicate vendor account code** (Add Vendor form): checked explicitly before insert, returns `{ error: 'A vendor with account code "X" already exists.' }` instead of a raw DB error.
- **Pending/loading state**: standard `useActionState` pending flag disables the Save/Add button and swaps its label to "Saving...".
- **GL code list empty**: New Invoice form shows an inline hint ("No GL codes yet — add some under Setup > GL Codes.") rather than leaving the dropdown looking broken.
- **Negative escrow balance after invoice**: allowed and merely flagged in red text in the live preview — the server action does not reject it.

## Secondary Flows / Edge Cases
- **Vendor Check Register** (`/vendors/check-register`): mirrors the Lender Check Register exactly in structure (same sort options, same 90-day default window, same 1000-row cap, same "Show All" link) but filters with `NOT isLenderPayeeSql` instead of the positive match, so the two registers partition the same `checks`/`checkLineItems` data without overlap.
- **Statements** (`/vendors/statements`): unimplemented stub — "Coming soon," no data or form wired up.
- **Vendor detail's disbursement table** always inner-joins to `contracts` (`eq(vendorDisbursements.contractId, contracts.id)`) — unlike the check-register pages, there is no left-join/orphan-row handling here, so a disbursement row somehow missing its contract would simply be excluded from the vendor's own history (unconfirmed whether this can occur given `contractId` is `NOT NULL` on `vendorDisbursements`).
- **Inline vendor creation from New Invoice** reuses the same account-code auto-generation as nothing else in the UI — there's no way to preview or edit the generated code before it's assigned; staff wanting a specific code must use the full Add Vendor form (`/vendors/new`) instead.
- **AI check extraction** (`src/server/checkExtraction.ts`) uses `claude-opus-4-8` vision with a strict JSON-schema output to read payer name, amount, check number, and date off an uploaded check image — but this lives entirely under `/bulk-payment` for incoming borrower checks. It does not power any vendor-facing feature (there is no outbound check-printing or check-scanning flow under `/vendors` at all).

## Open Questions / Known Gaps
- **No visible "Add Vendor" link from `/vendors`.** The route and form are fully built, but the list page itself doesn't render a button/link to it in the reviewed code.
- **Missing vendor detail page fails silently** (`return null` with no 404/redirect), same pattern as the Lenders feature.
- **Vendor Statements is unbuilt** — route exists, renders only a "Coming soon" placeholder.
- **No outbound vendor check printing exists anywhere in this codebase** despite "Payment Method: Check" being selectable on every invoice — there is no `/vendors/print-checks` route (unlike Lenders, which at least has a stub route for this). It's unclear whether vendor check printing is meant to reuse a shared/contract-level print flow not covered by this review, or hasn't been scoped yet.
- **Negative escrow balances are allowed.** The New Invoice form warns visually but does not block an invoice that would drive a contract's escrow/trust balance negative.
- **No pending/approval workflow.** Every invoice is posted immediately and irreversibly (no way to edit/void/reverse a bad entry found in this feature — presumably requires direct DB correction or a reversing entry elsewhere in the app).
- **`checkExtraction.ts`'s relationship to Vendors is indirect.** It was flagged in scope for this review, but functionally belongs to the Bulk Payment feature (incoming borrower checks), not vendor disbursement/check-writing — documented here for completeness but it is not a vendor capability.
