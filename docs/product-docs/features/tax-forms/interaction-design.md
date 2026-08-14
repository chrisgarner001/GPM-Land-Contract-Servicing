# Tax Forms — Interaction Design

## Entry Points
- Route: `/tax-forms` (`src/app/tax-forms/page.tsx`).
- Reached from the internal sidebar as a top-level nav item, "Tax Forms" (`src/app/_components/Sidebar.tsx`, next to "Tax Bill Processing" and "Escrow Maintenance").

## Primary Flow
There is no flow to describe. The page renders one static heading and one static line of text ("Coming soon.") and nothing else. There is no form, no report generation, no list, and no server action wired to this route.

## States & Transitions
Only one state exists: the static placeholder page. There is no loading, empty, error, or success state because there is no data or interactivity on this route.

## Secondary Flows / Edge Cases
None — there is nothing beyond the single static render.

## Open Questions / Known Gaps
- **The entire feature is unbuilt.** The route is live and navigable from the sidebar, implying it is a planned/expected feature, but zero implementation exists.
- **Intended scope is unconfirmed.** The assignment's working assumption — year-end 1098-style interest statements for borrowers — is a reasonable guess given this is a loan servicing system, but a repo-wide search turned up no code, schema, or comments referencing `1098`, IRS forms, or any year-end tax-document concept anywhere in the codebase.
- **Distribution channel is unknown.** If built, it's unclear whether generated forms would be delivered through the existing borrower portal (`src/app/online-portals/borrowers`), emailed, or only produced for internal/print use — there is no borrower-facing "tax documents" section currently in the portal to infer this from.
- **No underlying "interest paid per year" aggregation exists yet.** The ledger (`payments`/`payment_allocations`) already tags `INTEREST` allocations per payment, so a per-contract, per-calendar-year interest total is computable from existing data, but no query or report currently does this anywhere in the codebase.
