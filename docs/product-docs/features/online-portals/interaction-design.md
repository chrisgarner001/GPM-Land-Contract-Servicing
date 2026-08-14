# Online Portals — Interaction Design

## Entry Points
- `/online-portals` — generic landing page (`src/app/online-portals/page.tsx`), currently just a header + "Coming soon."
- `/online-portals/borrowers` — borrower portal route (`src/app/online-portals/borrowers/page.tsx`). No longer linked from the Sidebar (the "Borrowers" → "Online Portals" child nav item was removed as part of this change, since it pointed at a stub and duplicated the Borrowers list, which is now the actual entry point). Reached only via the **Log In As** button on `/borrowers`.
- `/online-portals/lenders` — lender portal route (`src/app/online-portals/lenders/page.tsx`). Not linked from the internal Sidebar (`src/app/_components/Sidebar.tsx` has no nav entry for it) — lenders reach it via a direct URL given to them by staff. This is also the only portal path exempt from the staff auth gate in `src/proxy.ts`.

## Primary Flow (Lender Portal)
1. Lender navigates to `/online-portals/lenders` with no session cookie. `getLenderPortalSession()` returns `null`, so the page renders `<LoginForm />` only (no header/logo chrome beyond what's inside the form).
2. Lender enters **Email** and **Portal PIN**, clicks **Sign In**. This calls the `lenderLoginAction` server action via `useActionState`.
3. Server validates both fields are non-empty, then queries `parties` joined to `contractParties` for rows matching `ilike(email)` + exact `portalPin`, restricted to `role = INVESTOR_PAYEE` and `ownershipPercent > 0`, using `selectDistinct` on `parties.id` (so one login can map to many `parties`/entities).
   - No match → returns `{ error: "Email or PIN not recognized." }`, shown in red under the form; button re-enables.
   - Match(es) found → `createLenderPortalSession(partyIds)` writes the signed cookie, `revalidatePath("/online-portals/lenders")` refreshes the page.
4. Page re-renders with a session:
   - **Exactly one** linked party → goes straight to that entity's dashboard (skips the picker).
   - **Multiple** linked parties, no `?as=` param (or an `?as=` not in the list) → shows "Select an Account" with a count ("Your login is linked to N lender accounts.") and an alphabetically sorted list of entity names as links to `/online-portals/lenders?as={id}`.
5. On the dashboard: header shows "Welcome, {lender.displayName}" and a contract count, a **Switch Account** link (only if >1 entity) back to the picker, and **Sign out**.
6. Two tables render: "funded contracts" (contract #, status, ownership %, principal balance) and "Ledger Activity" (last 50 entries, newest first: date, reference, contract #, description, net amount = received − paid out, running balance).
7. **Sign out** submits `lenderLogoutAction`, which clears the cookie and revalidates the page, returning the user to the login form.

## Primary Flow (Borrower Portal — Staff "Log In As")
1. Staff open `/borrowers` and find the contract row for the borrower they want to preview.
2. If that contract's `borrowerPortalEmail` and `borrowerPortalPin` are both set, the row's **Online Portal** column shows an **Active** pill plus a **Log In As** button (mirrors the Lenders list exactly); otherwise it shows a **Not Set Up** pill and no button.
3. Clicking **Log In As** calls `logInAsBorrowerAction(contractId)`, which creates a `borrower_portal_session` cookie holding that single `contractId` (no sibling-resolution needed — the login is already keyed to exactly this contract) and redirects to `/online-portals/borrowers`.
4. The dashboard renders the contract summary (contract #, status, current principal balance, next payment date, payment amount/frequency) and the last 50 payment-history rows for that contract (received date, method, amount, status), most recent first.
5. **Sign out** clears the cookie and returns to the "not signed in" state.
6. Visiting `/online-portals/borrowers` directly with no session shows a plain "You're not signed in" message — there is no login form to fill in, since self-service borrower login is out of scope for this pass (see Open Questions).

## States & Transitions
- **No session / logged out** → `LoginForm`.
- **Login error** (empty fields or no match) → red inline error text below the button; form stays filled except the browser's own password-field clearing behavior for PIN.
- **Pending submit** → button text switches to "Signing in..." / disabled, via `useActionState`'s `pending` flag.
- **Single-entity session** → dashboard shown directly, no "Switch Account" link.
- **Multi-entity session, no valid `as`** → account picker list.
- **Multi-entity session, valid `as`** → dashboard for that entity, with "Switch Account" visible.
- **Session cookie present but its party ID somehow resolves to no `parties` row** (`getLenderPortalData` returns `null`, e.g. party deleted after login) → falls back to rendering `LoginForm` again rather than erroring.
- **Empty states**: "No contracts on file." (colspan 4) and "No ledger activity recorded." (colspan 6) render inside their respective tables when the arrays are empty.
- **Borrower portal, no session** → plain "not signed in" message (no login form).
- **Borrower portal, valid session** → dashboard for that one contract; no picker state exists since a borrower session is never multi-entity.
- **Borrower portal, session cookie present but its `contractId` no longer resolves to a contract** (e.g. contract deleted) → falls back to the "not signed in" message, same defensive pattern as the lender portal's dangling-party-id case.
- **Borrower payment history empty state**: "No payments on file." renders inside the table when there are none.

## Secondary Flows / Edge Cases
- Tampered or malformed session cookie (bad signature, non-JSON payload, non-string-array payload) is treated as "no session" (`getLenderPortalSession` returns `null` in every failure branch), sending the user back to the login form rather than throwing.
- `?as=` values not present in the signed-in party list are ignored (`partyIds.includes(as)` check), falling back to the picker-or-single-entity logic rather than trusting the query param blindly — this prevents a lender from viewing another lender's data by guessing/editing the URL.
- The ledger's "Amount" column is a derived value (`amountReceivedCents - amountPaidOutCents`), not a stored column, computed at render time in `getLenderPortalData`.
- Cookie is scoped with `path: "/online-portals/lenders"`, so it is not sent to (and doesn't leak into) any staff-side route.

## Open Questions / Known Gaps
- **Self-service borrower login is still not built.** This pass only wires up staff-driven "Log In As" access (session + dashboard). A real external borrower still cannot sign into their own portal — that needs its own login form (email + PIN, mirroring `lenders/actions.ts`'s `lenderLoginAction`) plus adding `/online-portals/borrowers` to `PUBLIC_PATHS` in `src/lib/supabase/proxy.ts` so an unauthenticated visitor isn't redirected to staff `/login` first. Recommended as a follow-up task once this staff-facing slice ships.
- **Duplicate email/PIN across contracts already exists in production data (confirmed, not hypothetical).** The borrower login model assumes one `borrowerPortalEmail`+`borrowerPortalPin` pair maps to exactly one contract (co-buyers on *that* contract share it). At least one pair is already duplicated across more than one contract. This doesn't break staff Log In As (keyed directly by `contractId`, never by an email/PIN lookup), but the future self-service login has no defined resolution for it (unlike lenders, where "one login, many entities" is the intended design, not a data error) — needs a data cleanup pass or a uniqueness constraint before that login form is built.
- **No rate limiting or lockout** visible on `lenderLoginAction` — repeated PIN guesses against a known email are not throttled in the code reviewed. The same would apply to any future borrower self-service login.
- **`ownershipPercent > 0` filter without an explicit `endDate IS NULL` check**: `lenders/page.tsx`'s `getLenderPortalData` and `lenders/actions.ts`'s login query both filter on `ownershipPercent > 0` but do not appear to also filter `contractParties.endDate IS NULL`, even though the schema comment on `fundedAmountCents` says "current" funding rows are identified by `endDate IS NULL AND ownershipPercent > 0`. If a historical/superseded funding row is left with a nonzero `ownershipPercent`, it could show up here — worth verifying against how other internal lender pages filter this.
- **No visible way for a lender to reset a forgotten PIN** from the portal itself; presumably a staff-assisted process via the (out-of-scope) lender edit screen.
