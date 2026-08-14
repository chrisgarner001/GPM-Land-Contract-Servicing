# Serverless / Deployment Runtime

This app deploys to **Vercel** (`.vercel/project.json` links the repo to a Vercel project) as a standard Next.js App Router app. There are no hand-written serverless functions (no `src/app/**/route.ts`, no `/api` directory, no standalone Lambda/Edge function definitions) — the entire server-side surface is:

- **Server Components** (page.tsx files that read data at request time)
- **Server Actions** (`actions.ts` files — see `api-contracts.md`) — each one is its own serverless function under the hood on Vercel
- **Middleware** — `src/proxy.ts`, which runs on every request matching its `config.matcher` (everything except `_next/static`, `_next/image`, favicon, and common image extensions) to refresh the Supabase session and enforce the staff-auth gate

`next.config.ts` currently has no custom configuration — no runtime overrides, no rewrites/redirects, no experimental flags. If a task needs one of these, it's new territory for this config file, not an existing pattern to extend.

## Database Connections

`src/db/client.ts` opens a `postgres-js` connection using `DATABASE_URL` at module load. In a serverless environment, this means **a new connection (or connection from a fresh pool) can be created per invocation** unless the underlying Postgres provider handles pooling (Supabase's pooled connection string, PgBouncer, etc.). This project doesn't currently show its own connection-pooling logic in `src/db/client.ts` — if a task starts hitting connection-limit errors under load, that's the first place to look, and the fix belongs in how `DATABASE_URL` is provisioned (e.g. Supabase's pooler endpoint) rather than in application code.

## What's *Not* Part of the Deployed App

`scripts/` (import/analysis one-offs, e.g. `parse-tmo-export.ts`, `import-lender-statements.ts`, `seed.ts`) and the CSVs under `import-data/` are **not part of the running application** — they're run locally/ad-hoc via `npx tsx` or similar, not deployed, not wired into any Server Action or route. Don't assume code in `scripts/` executes in production, and don't assume production has access to `import-data/`'s contents at runtime.

## Cold Starts & Middleware Cost

Because `src/proxy.ts` runs on nearly every request (per its broad matcher) and does a Supabase session refresh, it's on the hot path for every staff-facing page load. Keep it minimal — it's not the place to add additional per-request logic (audit logging, feature flags, etc.) without considering the latency cost across every request in the app.
