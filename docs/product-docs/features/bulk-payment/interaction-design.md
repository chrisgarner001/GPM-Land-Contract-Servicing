# Bulk Payment — Interaction Design

## Entry Points
- Route: `/bulk-payment` (`src/app/bulk-payment/page.tsx`).
- Reached from the internal sidebar under "Land Contracts" → "Bulk Payment" (`src/app/_components/Sidebar.tsx`).
- The page server-loads the list of active contracts (`getActiveContractOptions`) before rendering, so the manual-match dropdown is populated immediately.

## Primary Flow
1. Staff selects one or more check image files in the "Upload Check Images" file input (`name="checks"`, accepts png/jpeg/webp/gif, `multiple`, `required`) and clicks **Extract**.
2. This submits a form action wired to `handleFiles`, which calls the `extractChecks` server action inside a transition (button shows "Reading checks..." and is disabled while pending).
3. For each uploaded file, `extractChecks` (in `src/app/bulk-payment/actions.ts`) base64-encodes the image, calls `extractCheckData` (Claude vision) to get payer name / amount / check number / date, then calls `findMatchingContract(payerName)` to look for a best-scoring active `BUYER`/`CO_BUYER` match (token-overlap score > 0.4).
4. Results populate a "Review & Match" table, one row per check, each row defaulted with `receivedDate = today` and `include = amountCents > 0`.
5. Staff review each row: toggle **Include**, edit the **Amount** (`$` input), edit **Date Received**, and pick a contract from the **Matched Contract** dropdown (pre-selected if a match was found, otherwise blank with the placeholder "— No match, select manually —"). Rows with no auto-match are highlighted with an amber background.
6. Staff click **Record Payments**. `handleSubmit` filters to rows where `include && matchedContractId && amountCents > 0`, and calls `submitBulkPayments` with one entry per row (`contractId`, `amountCents`, `receivedDate`, `referenceNumber` = check number).
7. `submitBulkPayments` (server action) loads the current Supabase user (for `actorEmail`) and loops the submissions, calling `recordPayment()` for each; it counts successes and collects `{ contractId, error }` for failures.
8. On return, a result message is shown ("Recorded N payment(s)." plus a failure summary if any), and **all submitted rows** — whether they succeeded or failed — are removed from the table.

## States & Transitions
- **Empty state:** no rows shown until an extraction completes; only the upload form is visible.
- **Loading (extracting):** Extract button reads "Reading checks..." and is disabled; happens inside a `useTransition`.
- **Loading (submitting):** Record Payments button reads "Recording..." and is disabled.
- **Validation failure (no files):** `extractChecks` returns `{ rows: [], error: "No check images selected." }` if the file list is empty after filtering out zero-size entries; shown in red text under the upload form.
- **Per-check extraction failure:** caught individually — that row still appears, with `payerName` set to `(Failed to read: <error message>)`, `amountCents: 0`, no match, and (because `amountCents` is 0) `include` defaults to `false`. The batch overall does not fail because one image failed.
- **No matched contract:** row rendered with amber background (`bg-amber-50`) and an empty "— No match —" dropdown selection; staff must pick manually before the row can be submitted.
- **Submit validation failure:** if no row is both included and matched (and amount > 0), `handleSubmit` sets an error ("No confirmed rows with a matched contract to record.") and does not call the server.
- **Partial success:** `submitBulkPayments` can return `recorded > 0` alongside a non-empty `failed` list; both counts are shown in the same result string, and both the succeeded and failed rows are removed from the table regardless.

## Secondary Flows / Edge Cases
- Editing the amount field recalculates the row's `amountCents` locally; the running total (`formatCents` sum of included rows) updates live.
- Selecting a contract manually also updates the row's stored `matchedContractLabel` from the dropdown's option list.
- A check with a legible amount of `$0.00` is excluded by default (via the `include: r.amountCents > 0` default) but can still be manually included/edited.
- Multiple checks matching the same contract are all allowed — nothing prevents recording two payments for the same contract in one batch.

## Open Questions / Known Gaps
- **No de-duplication guard.** Nothing checks whether a check (by check number, payer, amount, or date) has already been recorded, so the same physical check could be uploaded and recorded twice with no warning.
- **Failed submissions disappear from the review table.** `handleSubmit` removes every row whose id was submitted, whether `recordPayment` succeeded or threw — a failed row can only be identified from the one-line error summary text and must be fully re-entered (or re-extracted) to retry, since the original row data is gone from state.
- **No escrow/late-fee/charge split from this screen.** Every bulk payment is applied through the plain waterfall in `applyPayment` with no way to specify an escrow portion, late fee, or charge repayment for a given check, unlike the per-contract payment form.
- **Uploaded check images are never persisted.** They're read into memory, sent to the vision model, and discarded — there's no stored image to audit later or re-review if the extraction is wrong.
- **Matching is a simple heuristic with no visible confidence indicator.** The token-overlap score (threshold 0.4) is used internally to pick a "best" match, but the UI never shows the score or flags a low-confidence match differently from a high-confidence one — staff have to trust or double-check every auto-filled contract by eye.
- **Batch is not atomic.** Because `submitBulkPayments` calls `recordPayment` once per row in a loop, a failure partway through the batch does not roll back earlier successful payments in the same submission.
