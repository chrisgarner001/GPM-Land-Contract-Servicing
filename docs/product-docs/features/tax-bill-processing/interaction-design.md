# Tax Bill Processing — Interaction Design

## Entry Points
- Route: `/tax-bill-processing` (`src/app/tax-bill-processing/page.tsx`).
- Reached from the internal sidebar as a top-level nav item, "Tax Bill Processing" (`src/app/_components/Sidebar.tsx`, next to "Tax Forms" and "Escrow Maintenance").

## Primary Flow
There is no flow to describe. The page renders one static heading and one static line of text ("Coming soon.") and nothing else. There is no form, no file upload, no list, and no server action wired to this route.

## States & Transitions
Only one state exists: the static placeholder page. There is no loading, empty, error, or success state because there is no data or interactivity on this route.

## Secondary Flows / Edge Cases
None — there is nothing beyond the single static render.

## Open Questions / Known Gaps
- **The entire feature is unbuilt.** This is the most significant gap: the route is live and navigable from the sidebar, implying it is a planned/expected feature, but zero implementation exists.
- **Intended scope is unconfirmed.** The assignment's working assumption — that this matches incoming tax bills to contracts/escrow accounts for payment — is a reasonable guess based on the name and its neighboring nav items, but nothing in the codebase (schema, domain modules, or comments) confirms or details this.
- **No evidence it will reuse the check-processing pipeline.** `src/server/checkExtraction.ts` (used by Bulk Payment) and `src/server/checkClassification.ts` (used by the lender/vendor check registers) are the codebase's only document-vision-processing modules, and neither currently has any relationship to tax bills. Whether a future implementation would reuse this pattern (vision extraction + matching, as Bulk Payment does for checks) or take a different approach is unknown.
- **No related schema fields exist for a "tax bill" entity.** `src/db/schema/escrow.ts` has `trust_ledger_entries` (disbursement history) and `escrow_vouchers` (recurring payment templates for a given payee/amount/frequency) but no table representing an incoming, unprocessed tax bill document awaiting matching/approval.
