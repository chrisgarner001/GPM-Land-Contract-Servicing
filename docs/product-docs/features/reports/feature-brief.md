# Reports

## Purpose
Intended as the reporting hub for the servicing system — a place to run cross-contract/cross-lender reports. As currently built, this is a placeholder: the route exists and is linked from navigation, but no actual report has been implemented yet.

## Users
Internal staff (the route sits behind the standard Supabase staff-auth gate in `src/proxy.ts` / `src/lib/supabase/proxy.ts` — it is not one of the exempted public paths).

## Core Capabilities
- None implemented yet. `src/app/reports/page.tsx` renders only a page title ("Reports") and a "Coming soon." message — there are no forms, tables, filters, exports, or server actions in this directory.

## Data Touched
- None. The page performs no database queries and has no colocated `actions.ts`, domain, or server module. (A wider grep across `src/` for "reports" only turned up the page itself and its Sidebar nav entry.)

## Key Constraints / Business Rules
- N/A — no logic exists yet to constrain.

## Related Features
- Once built, this would likely draw on the same domain modules used elsewhere in the app (`src/domain/amortization`, `src/domain/escrow`, `src/domain/ledger`, `src/domain/lending`) and schema tables (`contracts`, `payments`, `lenderLedgerEntries`, `charges`, `escrow`) to produce servicing/portfolio-level summaries, but none of that wiring exists today.
