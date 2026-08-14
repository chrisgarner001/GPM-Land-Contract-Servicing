# Conversations

## Purpose
Route name suggests a hub for communications/messages (e.g. borrower or lender correspondence). As currently built, it is an empty placeholder with no defined purpose beyond the page title — there is no schema table, domain logic, or server action backing it.

## Users
Presumably internal staff (the route is not among the exempted public paths in `src/lib/supabase/proxy.ts`, so it sits behind the standard Supabase staff-auth gate), but since nothing is implemented this is inferred from placement, not confirmed by behavior.

## Core Capabilities
- None implemented. `src/app/conversations/page.tsx` renders only a heading ("Conversations") and "Coming soon." — no list, no compose UI, no filters, no actions.

## Data Touched
- None directly. Notably, `src/db/schema/notes.ts` already defines tables that look conceptually related to a "conversations" feature — `contractNotes` (staff notes per contract), `partyNotes` (staff notes per party), `partyEmails` (captured borrower emails synced from the shared `info@successgroupmortgage.com` mailbox, matched by loan-account number or sender/recipient address), and `partyEmailDrafts` (staff-composed outgoing emails queued for a human to turn into a real Gmail draft) — but a targeted search found **no import or usage of any of these tables from `src/app/conversations/`**. Nothing in the conversations page references `notes.ts`.
- No use of `@anthropic-ai/sdk` in this feature. The SDK is a real dependency (`package.json`) and is used elsewhere — `src/server/checkExtraction.ts` calls `client.messages.create(...)` with a JSON-schema structured output to OCR payer name/amount/check number/date off scanned check images (used by the check-printing/bulk-payment flows) — but `src/app/conversations/page.tsx` has zero imports and zero AI-related code. Any AI angle for "Conversations" would need to be built from scratch; it does not exist today.

## Key Constraints / Business Rules
- N/A — no logic exists yet.

## Related Features
- The likely eventual backing store is `src/db/schema/notes.ts` (`contractNotes`, `partyNotes`, `partyEmails`, `partyEmailDrafts`), which already models append-only staff notes and a synced/queued email trail per borrower/party. Whoever builds this feature should look there first rather than creating new tables.
