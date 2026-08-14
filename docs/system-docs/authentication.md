# Authentication

There are **two separate, independent auth systems** in this app, gating two separate audiences. They do not share sessions, cookies, or user tables — treat them as fully distinct when working on either.

## 1. Staff Auth (Supabase)

Internal servicing staff authenticate through **Supabase Auth**, using the standard email/session cookie flow:

- `src/lib/supabase/client.ts` — browser client (`createBrowserClient`)
- `src/lib/supabase/server.ts` — server client for Server Components/Actions (`createServerClient`, reads/writes cookies via `next/headers`)
- `src/lib/supabase/proxy.ts` — the actual gate, invoked from `src/proxy.ts` (Next.js middleware) on every request

`src/lib/supabase/proxy.ts`'s `updateSession()`:

1. Refreshes the Supabase session cookie on every request (`supabase.auth.getUser()` — the code comments explicitly warn not to remove this call, since it's what keeps the cookie fresh, not just an auth check).
2. Defines `PUBLIC_PATHS = ["/login", "/online-portals/lenders"]` — everything else requires a logged-in staff user.
3. Redirects unauthenticated users hitting a non-public path to `/login`.
4. Redirects an already-authenticated user away from `/login` to `/contracts`.

Login itself is handled by `src/app/login/actions.ts` (a Server Action, not a route handler).

**`/online-portals/lenders` is explicitly exempted from the staff gate** — external lenders never get a staff account, so that whole subtree has to bypass it (see system #2 below). Note `/online-portals/borrowers` is *not* in `PUBLIC_PATHS` as of this writing — confirm whether that's intentional (staff-only visibility into borrower data by design) or a gap before building anything that assumes borrowers can reach that path unauthenticated.

## 2. Lender Portal Auth (custom email + PIN)

External lenders authenticate separately, through `src/app/online-portals/lenders/actions.ts` (email + PIN, not a Supabase account), and get a **custom signed cookie session** — `src/lib/lenderPortalSession.ts`:

- Cookie name: `lender_portal_session`, scoped to `path: "/online-portals/lenders"`, `httpOnly`, `secure` in production, `sameSite: "lax"`, 7-day max age.
- Payload: a JSON array of `partyIds` (base64url-encoded), **HMAC-SHA256 signed** with `LENDER_PORTAL_SESSION_SECRET`. Verified with `timingSafeEqual` — deliberately resistant to timing attacks on the signature check.
- **One login can resolve to many lender entities.** The code comment is explicit: a single analyst's email+PIN has been observed managing 25+ investor LLCs. The session holds every `partyId` that login is entitled to; the portal UI is responsible for letting the user pick which entity they're viewing at any given moment.
- There is no server-side session store — the cookie itself, plus its signature, is the entire session. Revoking access means changing `LENDER_PORTAL_SESSION_SECRET` (which invalidates *every* lender session at once) or removing/rotating the underlying email+PIN credential, not a per-session revoke.

## Required Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — staff auth (also listed in `.env.example`)
- `LENDER_PORTAL_SESSION_SECRET` — lender portal session signing. **Not currently listed in `.env.example`** — worth adding, since the code throws (`getSecret()`) if it's unset.

## Working on Auth-Adjacent Code

- Never move the `supabase.auth.getUser()` call out of `updateSession()` — it's load-bearing for session refresh, not just a permission check (per the existing code comment).
- If a task adds a new public (unauthenticated) staff-side route, it must be added to `PUBLIC_PATHS` in `src/lib/supabase/proxy.ts` — nothing else grants that exemption.
- If a task adds a new lender-portal capability, remember the session can represent multiple lender entities — never assume `partyIds[0]` is "the" lender without checking which entity the UI currently has selected.
