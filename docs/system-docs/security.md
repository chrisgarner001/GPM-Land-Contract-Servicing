# Security

## PII Encryption

`src/lib/encryption.ts` implements AES-256-GCM encryption for at-rest storage of the fields the code's own comment identifies as the only ones worth real encryption: **full SSN/TIN and full ACH account number** — "the only two fields in the app that store something an attacker could directly misuse if the database were ever exposed." Everything else is treated as a plain column.

- Key: `PII_ENCRYPTION_KEY`, a 32-byte key supplied as 64 hex characters. `getKey()` throws if it's missing or the wrong length — this is checked at call time, not at startup, so a missing key surfaces as a runtime error the first time encryption is actually exercised.
- Storage format: `"iv:authTag:ciphertext"`, each component hex-encoded, a fresh random IV (`randomBytes(12)`) per encryption call.
- **Not currently listed in `.env.example`** — same gap as `LENDER_PORTAL_SESSION_SECRET` (see `authentication.md`). Anyone setting up a new environment from `.env.example` alone will hit a runtime crash the first time PII encryption/decryption is invoked, with no advance warning.

If a task touches any field that should be treated with the same sensitivity as SSN/TIN or ACH account numbers (e.g. a new payment-method field that stores raw bank details), route it through `encryptPII`/`decryptPII` rather than storing it as a plain column — that's the established bar in this codebase for "an attacker could directly misuse this."

## Secrets & Environment Variables

All secrets are environment variables, no secrets manager in front of them. Current known set:

| Variable | Purpose | In `.env.example`? |
|---|---|---|
| `DATABASE_URL` | Postgres connection (Drizzle) | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Yes |
| `PII_ENCRYPTION_KEY` | AES-256-GCM key for SSN/TIN/ACH encryption | **No — gap** |
| `LENDER_PORTAL_SESSION_SECRET` | HMAC signing key for lender portal sessions | **No — gap** |

Note the two `NEXT_PUBLIC_*` Supabase variables are, by Next.js convention, exposed to the browser bundle — that's expected for the anon key (it's meant to be public; access control is Supabase's RLS/auth layer, not secrecy of this value), but don't reflexively prefix a future secret with `NEXT_PUBLIC_` just to match the existing pattern.

## Timing-Safe Comparison

`lenderPortalSession.ts` verifies its HMAC signature with `crypto.timingSafeEqual`, guarding against timing attacks on signature comparison. If a task adds another signed-token scheme, follow the same pattern — don't drop to `===` string comparison for secret-derived values.

## Data Access Boundaries

There is no API layer separate from Server Actions (see `api-contracts.md`), so there's no separate "API security" surface to reason about beyond: (1) the staff-auth gate in `src/proxy.ts`, (2) the lender-portal cookie session, and (3) whatever a given Server Action checks for itself before touching the database. Because auth checks are per-action rather than centrally enforced for mutations, **a new action that forgets to check `supabase.auth.getUser()` (or the lender session) is a real, easy-to-make gap** — there is no middleware net catching a missing check inside an already-reachable page. Treat "does this action verify who's calling it, and that they're allowed to do this specific thing" as a required review question for any new or modified `actions.ts` function.
