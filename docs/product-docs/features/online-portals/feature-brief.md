# Online Portals

## Purpose
Gives external parties — lenders (investors who fund land contracts) and borrowers (buyers on land contracts) — a self-service window into their own account data, without giving them a staff login. This reduces phone/email volume for routine "what's my balance / when's my next check" questions and is the one part of the app that intentionally lives outside the staff Supabase-auth boundary.

## Users
- **Lenders** (external investors), via `/online-portals/lenders` — fully implemented, with its own email+PIN login.
- **Borrowers** (land contract buyers), via `/online-portals/borrowers` — implemented for **staff-driven access only**: a staff member clicks **Log In As** from the Borrowers list (`/borrowers`) to preview a specific contract's portal dashboard. There is still no self-service login form for a real external borrower to sign in on their own — that remains a deferred follow-up (see Open Questions).
- **Staff**, indirectly: they configure lenders' `portalPin`/`email` on the `parties` record, and borrowers' `borrowerPortalPin`/`borrowerPortalEmail` on the `contracts` record (no dedicated setup UI found for either in the explored files — presumably part of the lender/contract edit forms elsewhere).

## Core Capabilities
- Lender portal login with email + PIN (see `lenderPortalSession.ts` and `lenders/actions.ts`).
- A single email+PIN login can resolve to multiple lender entities (e.g. one analyst managing 25+ investor LLCs). After login, if more than one entity matches, the user sees an "Select an Account" list and picks which entity to view (`?as={partyId}` query param); if only one matches, it's shown directly.
- Once viewing an entity, the lender sees:
  - A list of land contracts they hold `INVESTOR_PAYEE` ownership in (contract number, status, ownership %, current principal balance), scoped to rows where `ownershipPercent > 0`.
  - Their last 50 lender-ledger entries (date, reference, contract, description, net amount, running balance), most recent first.
- "Switch Account" link (only shown when multiple entities are linked) to return to the entity picker.
- Sign out, which clears the session cookie.
- **Borrower portal dashboard** (`/online-portals/borrowers`) — reached only via staff **Log In As** today:
  - Unlike lenders, a borrower login is keyed to exactly **one contract** (co-buyers on that contract share the one PIN — this is not the "one login, many entities" model lenders use), so there is no multi-entity picker or `?as=` resolution here — the session holds a single `contractId`.
  - Shows the contract summary (contract #, status, current principal balance, next payment date, payment amount/frequency) and the last 50 entries from that contract's payment history (`payments`/`paymentAllocations`), most recent first.
  - Sign out, which clears the borrower session cookie.
  - With no active session, the page shows a plain "not signed in" message rather than a login form — there is intentionally no self-service entry point yet.
- `/online-portals` itself is just a landing stub ("Coming soon") linking conceptually to the two sub-portals.

## Data Touched
- `parties` — lender identity, `email`, `portalPin` (read for login matching); `displayName` (read for display).
- `contractParties` — join table used to find contracts where the party has an active `INVESTOR_PAYEE` role with positive ownership.
- `contracts` — contract number, status, current principal balance cents, next payment date, payment amount/frequency; also `borrowerPortalPin`/`borrowerPortalEmail`, now read by the borrower dashboard and by staff's Log In As lookup.
- `lenderLedgerEntries` (`src/db/schema/lending.ts`) — per-lender clearing ledger: transaction date, reference, description, amounts, running balance, optional `sourceContractId` (null for swept-out "Lender Check" distributions).
- `payments` / `paymentAllocations` (`src/db/schema/payments.ts`) — a contract's payment history, read (not written) by the borrower dashboard.
- No writes happen in either portal beyond session-cookie creation/deletion — both are read-only for financial data.

## Key Constraints / Business Rules
- Auth boundary: `src/proxy.ts` → `src/lib/supabase/proxy.ts` gates every route behind staff Supabase auth except `/login` and `/online-portals/lenders` (`PUBLIC_PATHS`). `/online-portals/borrowers` is deliberately **not** in `PUBLIC_PATHS` — because there's no self-service login yet, every visit to that route today comes from an already-authenticated staff member (via Log In As), so it correctly stays behind the staff gate. Adding real borrower self-service later will require adding it to `PUBLIC_PATHS`, same as lenders.
- Lender session cookie (`lender_portal_session`) is HMAC-SHA256 signed, `httpOnly`, `sameSite=lax`, `secure` in production, scoped to path `/online-portals/lenders`, 7-day max age. Signature is checked with `timingSafeEqual` to avoid timing attacks.
- Borrower session cookie (`borrower_portal_session`) uses the identical signing scheme, scoped to path `/online-portals/borrowers`, holding a single `contractId` string (not an array, per the 1-login-to-1-contract model above). Max age is **30 minutes**, deliberately shorter than the lender session's 7 days, since this is a staff impersonation preview rather than a remembered login.
- Login matching requires exact PIN match and case-insensitive email match (`ilike`), AND the party must have at least one `contractParties` row with role `INVESTOR_PAYEE` and `ownershipPercent > 0` — a lender party with no active funding position cannot log in even with a correct email/PIN.
- Only contracts with `ownershipPercent > 0` show; historical/superseded funding rows (`endDate` set) are excluded from the "funded contracts" table (via the `gt(ownershipPercent, "0")` filter, though note this doesn't explicitly filter `endDate IS NULL` — see Open Questions).
- Money is displayed via `formatCents`/`formatPercent`/`formatDate` (`src/lib/format`), consistent with the whole-cents-at-rest convention.

## Related Features
- Depends on **Lenders** (`src/app/lenders/`) for the underlying party/contract data and ledger entries, and on **Setup > Bank Accounts** indirectly (a lender's `defaultBankAccountId` is set there, though not shown in the portal itself).
- Depends on **Borrowers** (`src/app/borrowers/`) for the Online Portal status column and Log In As action that is the only entry point into the borrower dashboard today.
- Feeds off the same `lenderLedgerEntries` table that presumably backs internal lender statements/check-printing (`src/app/lenders/print-statements`, `print-checks`, `check-register`), though those are outside this assignment's scope.
