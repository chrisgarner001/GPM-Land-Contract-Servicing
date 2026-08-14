# Borrowers — Interaction Design

## Entry Points
- `/borrowers` — top-level nav destination, the searchable list of all (contract, buyer) pairs.
- `/borrowers/[partyId]` — reached by clicking a borrower name link from `/borrowers`, or from a contract's layout header (buyer name links to `/borrowers/${partyId}` in `src/app/contracts/[contractId]/layout.tsx`).

## Primary Flow — Looking Up a Borrower and Adding a Note
1. Staff lands on `/borrowers`, optionally types a search term (`q` query param) and clicks **Search** — filtering happens server-side against the fully-loaded row set (account, name, address, city, phone, email), no pagination.
2. Staff clicks a borrower's name, landing on `/borrowers/[partyId]`.
3. Page header shows display name, phone (or "No phone on file"), and mailing address if present.
4. "Land Contracts" table lists every BUYER-role contract for this party with a link into `/contracts/${contractId}`.
5. "Communications" panel shows Documents (Drive links from any of their contracts), captured Emails (subject, sender → recipients, timestamp, snippet), the Compose Email form, and Notes.
6. Staff types into the `PartyNotesSection` textarea and clicks **Add Note** — `addPartyNote` server action validates non-empty body, reads the Supabase session for `authorEmail`, inserts into `partyNotes`, and `revalidatePath`s the page; the new note appears immediately at the top of the list (most recent first).

## Primary Flow — Queuing an Outgoing Email
1. Staff fills in To (pre-filled from `party.email`, falling back to any contract's `borrowerPortalEmail`), Subject, and Message in `ComposeEmailForm`.
2. Submits — `composeEmail` action validates a non-empty, regex-shaped recipient address, non-empty subject, non-empty body; on failure shows the specific error inline in red.
3. On success, inserts a `PENDING` row into `partyEmailDrafts` and shows: "Queued — an admin will create the Gmail draft for review and sending shortly."
4. The queued/drafted list below the form re-renders showing status badges — "Pending" (amber) for `PENDING`, "Draft ready in Gmail" (blue) for `DRAFTED` — but the app itself has no UI to transition a row from PENDING to DRAFTED; that happens out-of-band.

## States & Transitions
- **Empty states**: borrower detail page shows "No Google Drive folders linked yet." and "No emails captured yet. Ask staff to run a communications sync to pull matching messages from info@successgroupmortgage.com." and "No notes yet."
- **List page empty/filtered state**: header always reads "{filtered count} of {total count} borrowers", so a search with zero matches is visually obvious (e.g. "0 of 214 borrowers") even though there's no dedicated "no results" message row (the table simply renders with no rows).
- **Validation failure**: inline red text under the relevant form field/button (e.g. "Note cannot be empty.", "Enter a valid recipient email address.", "Subject is required.", "Message body cannot be empty.").
- **Success**: green inline text for the compose form; notes have no explicit success message, they just appear in the list (`useActionState` re-render) since `addPartyNote`'s returned state has no `success` field, only `error`.
- **Submitting state**: buttons read "Saving...OK"/"Queuing..." while pending.

## Secondary Flows / Edge Cases
- A borrower with **multiple contracts** sees them all in one table on their detail page, and each contract's own Drive link (if any) is surfaced separately in the Documents list — there's no single per-borrower attachments folder, only per-contract ones.
- **Default "To" address fallback chain**: `party.email` first, then the first contract found with a non-null `borrowerPortalEmail` — if neither exists the field starts blank and must be typed in manually.
- The list page's phone/email/PIN columns read from different tables depending on the field: phone comes from `parties`, portal email/PIN come from `contracts` (per the schema comment, borrower portal access is keyed by loan account, shared across co-buyers, not by party) — so two co-buyers on the same contract would show identical portal email/PIN values but different phone numbers if on file separately.

## Open Questions / Known Gaps
- **No borrower creation/edit UI is visible under `/borrowers`** — party records appear to be created only via the (largely unbuilt) Onboarding flow or directly in the database/migration scripts; there's no "Edit Contact Info" or "New Borrower" action found on either page here.
- **The email capture "sync" and the "create a Gmail draft" step are both entirely out-of-band** (per code comments, staff/agent-triggered, not automated inside this app) — there is no button or scheduled job visible in this codebase that performs either step; the empty-state copy just tells staff to "ask staff to run a communications sync," which implies a separate manual process or tool not part of this Next.js app.
- **Co-buyers**: the code explicitly notes portal PIN/email are shared per contract account rather than per party, but nothing in the UI distinguishes a primary buyer from a co-buyer on this page (that distinction — BUYER vs CO_BUYER role — is only shown on the Contract Terms tab, not here).
