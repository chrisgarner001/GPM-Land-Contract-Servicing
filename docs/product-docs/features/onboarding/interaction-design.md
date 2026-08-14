# Onboarding — Interaction Design

## Entry Points
- `/onboarding` — reached via top-level nav (implied by its presence as a route under `src/app/`; no explicit nav bar component was inspected in this pass, but the page is a standard top-level route like `/contracts` and `/borrowers`).
- `/onboarding/manual` and `/onboarding/import` — reached only via the two links on the `/onboarding` landing page (each also has its own "← On Boarding" back link).

## Primary Flow
1. Staff navigates to `/onboarding`.
2. Staff sees exactly two choices, presented as equal-weight cards/links: "Enter New Land Contract Manually" and "Import Land Contract Information."
3. Clicking either link navigates to a static page that renders a back link, an `<h1>` matching the choice just made, and the literal text **"Coming soon."**
4. There is no further step — no form fields exist to fill in, nothing to submit, and no data is created or changed.

## States & Transitions
- **Loading**: none — all three pages are plain server components with no data fetching.
- **Empty/stub state**: both `/onboarding/manual` and `/onboarding/import` are permanently in an "empty" (unimplemented) state — "Coming soon." is the entire page body besides navigation chrome.
- **Error/validation/success states**: not applicable — there are no forms or server actions in this feature to produce them.

## Secondary Flows / Edge Cases
- None to report — the feature has no branching logic, no conditional rendering, and no server-side behavior beyond static page rendering.

## Open Questions / Known Gaps
- **This feature is unimplemented.** Both intended flows ("Enter New Land Contract Manually" and "Import Land Contract Information") are stub pages with no forms, validation, server actions, or database writes. This is the single largest gap found across the three features documented in this pass.
- It's unclear from the code alone whether the intended "Import" flow will reuse the existing repo-root migration scripts (`scripts/import-tmo-data.ts` and its `parse-*.ts` helpers) as a library, wrap them in a new upload UI, or be built as an entirely separate CSV format/pipeline — the sample files in `import-data/` (`full_loan_master.csv`, `check_register.csv`, `vendor_statements.csv`, `sample_3_accounts.csv`, `accounts-needing-review.csv`) are all shaped for the one-time TMO historical migration (fixed-column "printed report" CSVs, one account per multi-page block) rather than a plausible ongoing bulk-import format for new contracts a servicer would originate going forward. Whether onboarding/import is meant to accept that same fragile fixed-column format or a simpler, purpose-built template is an open design question.
- No indication of what fields "Enter New Land Contract Manually" would collect — presumably at minimum property, buyer(s), lender/funding, and loan terms (principal, rate, term, payment, dates) mirroring `contracts`/`contractParties`/`parties`/`properties`, but nothing in the code confirms this.
- No UI test or Playwright coverage found for this feature (consistent with there being nothing yet to test).
