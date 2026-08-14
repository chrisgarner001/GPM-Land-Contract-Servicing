# Onboarding

## Purpose
Onboarding is meant to be the entry point for adding a brand-new land contract to the system — either by hand (one contract at a time) or via a bulk import. As of this pass through the code, it exists only as a landing page with two navigation choices; neither destination has been built out yet.

## Users
Internal staff only (Supabase-authenticated), same as the rest of the internal app.

## Core Capabilities
As currently implemented in `src/app/onboarding/`:
- **`/onboarding`** (`page.tsx`): a landing page titled "On Boarding" with the subtitle "Add a new land contract to the system," offering two links:
  - "Enter New Land Contract Manually" → `/onboarding/manual`
  - "Import Land Contract Information" → `/onboarding/import`
- **`/onboarding/manual`**: renders only a back link and the text **"Coming soon."** No form, no fields, no server action.
- **`/onboarding/import`**: renders only a back link and the text **"Coming soon."** No file upload, no CSV parsing, no server action.

Neither sub-page reads or writes any database table — there is currently no way to create a new contract through the application's UI.

## Data Touched
None yet, directly. When built, manual entry would presumably write to `src/db/schema/contracts.ts` (`contracts`, `contractParties`), `src/db/schema/parties.ts` (`parties`, `properties`), and possibly seed an initial escrow analysis (`src/db/schema/escrow.ts`) — mirroring the shape already used by the one-off migration scripts described below — but none of this is wired up in the app today.

## Key Constraints / Business Rules
None observable — there is no logic to describe yet. The only thing confirmed is the intended split: a manual single-contract entry path vs. a bulk import path, and that both are unimplemented (see interaction-design.md for what "Coming soon" looks like exactly).

## Related Features
- **Contracts** — the feature this is meant to feed; once built, onboarding would be how new rows appear in `/contracts`.
- **Borrowers** — manual/import onboarding would also be how new `parties` (buyers) get created.
- **Repo-root migration tooling (separate from this feature)** — `scripts/import-tmo-data.ts`, `scripts/parse-tmo-export.ts`, `scripts/parse-borrower-listing.ts`, `scripts/parse-check-register.ts`, `scripts/parse-lender-statements.ts`, `scripts/parse-vendor-statements.ts`, `scripts/parse-vendor-lender-address.ts`, `scripts/import-lender-addresses.ts`, and `scripts/import-lender-ledger.ts`/`import-lender-statements.ts` already exist and do real, working parsing of legacy servicer exports (see `import-data/*.csv`: a "Loan Master Report," a "Check Register," a "Vendor Statement of Account," and a hand-curated "accounts needing review" list) directly into the same schema tables this app uses. They are standalone Node scripts run from the repo root (not Next.js routes, not reachable from any page), used for the one-time historical migration from the prior servicing system (The Mortgage Office / TMO) rather than for ongoing new-contract onboarding. They are a strong reference for what real onboarding logic will eventually need (amortization schedule reconstruction via `generateSchedule`/`solveForTermMonths`, lender share calculation via `calculateLenderShare`, trust-ledger and payment-allocation reconstruction), but they are not part of, and are not invoked by, the `/onboarding` feature itself.
