# Borrowers

## Purpose
The Borrowers feature gives staff a person-centric (rather than contract-centric) view of each buyer: every land contract they're on, their contact/mailing info, and a lightweight communications hub (captured emails, a queue-for-review compose form, and free-text notes). It exists so staff have one place to look up "who is this person and what's the full history of talking to them," separate from the loan-specific detail already covered by the Contracts feature.

## Users
Internal staff only (Supabase-authenticated). No borrower-facing self-service UI lives under this route — that is handled by a separate borrower portal (`/online-portals/borrowers`, keyed by the contract's own `borrowerPortalEmail`/`borrowerPortalPin`). Staff use this list's **Log In As** action to preview that portal; see [online-portals](../online-portals/feature-brief.md) for the portal side of that flow.

## Core Capabilities
- **Browse all borrowers** (`/borrowers`): one row per (contract, buyer) pair — account #, borrower name, property address, phone, portal email, portal PIN, **Online Portal** status, and contract status — with free-text search across account, name, address, phone, and email.
- **Online Portal status & staff preview**: the Online Portal column shows an **Active** pill when both `borrowerPortalEmail` and `borrowerPortalPin` are set on the contract, or a **Not Set Up** pill when either is missing — identical derivation to the Lenders list's equivalent column. An **Active** row also gets a **Log In As** button that creates a staff impersonation session and opens that contract's borrower portal dashboard (`/online-portals/borrowers`) in a new session, scoped to the one contract the row represents.
- **View a borrower's detail page** (`/borrowers/[partyId]`): lists every land contract where this party has the `BUYER` role (account #, property, status, principal balance, each linking to that contract), a Documents section (any linked Google Drive folder from their contract(s)), a captured-email history, a compose-email form, and a notes section.
- **Compose an outgoing email**: staff fill in To/Subject/Message; it's queued as a `PENDING` record for an admin to turn into an actual Gmail draft (from `info@successgroupmortgage.com`) for human review before sending — the app itself never sends email directly.
- **View captured email history**: emails to/from the shared mailbox that have already been matched to this party by a separate sync process.
- **Add a free-text note** about the borrower (append-only, timestamped, author-attributed).

## Data Touched
- `src/db/schema/parties.ts` — `parties` (borrower contact/mailing info, encrypted tax ID fields not surfaced here) and `properties` (address, joined via the contract).
- `src/db/schema/contracts.ts` — `contracts` (status, principal balance, Google Drive link, portal email) and `contractParties` (filtered to `role = "BUYER"` to find a party's contracts).
- `src/db/schema/notes.ts` — `partyNotes` (staff notes on the person), `partyEmails` (captured inbound/outbound email history, matched via account number in the subject and/or known sender/recipient address), `partyEmailDrafts` (queued outgoing messages awaiting an admin-created Gmail draft).

## Key Constraints / Business Rules
- **A borrower row on the list page is really a (contract, buyer) pair**, not a unique person — a buyer on two contracts appears twice, once per contract, via an `innerJoin` on `contractParties` filtered to `role = "BUYER"`.
- **No outbound email is ever sent directly by the app** — `composeEmail` only inserts a `PENDING` row in `partyEmailDrafts`; an out-of-band admin process is required to actually create the Gmail draft (`status` becomes `DRAFTED`, `gmailDraftId` set) and send it.
- **Email capture is a one-way, on-demand sync**, not a live inbox connection — `partyEmails` rows are populated by a separate sync process (matched by loan-account number in the subject line and/or a sender/recipient address match), and `gmailMessageId` is unique so re-running the sync can't create duplicates.
- **Notes are append-only** — no edit/delete UI, consistent with the same pattern used for contract notes.
- Compose-email validation requires a non-empty, regex-valid recipient address, a non-empty subject, and a non-empty body.

## Related Features
- **Contracts** — each borrower detail page links out to every contract the party is a buyer on; the contract's own overview page links back to the borrower via the header.
- **Onboarding** — would be the entry point that creates new `parties`/`contractParties` (BUYER) records for this feature to surface, but that feature is not yet built (see onboarding docs).
- **Lenders** — a structurally similar party-centric view, distinguished by `contractParties.role = "INVESTOR_PAYEE"` instead of `BUYER`; its Online Portal column + Log In As action is the pattern this feature's own column mirrors.
- **Online Portals** (`/online-portals/borrowers`) — the borrower-facing dashboard this list's Log In As action opens; see that feature's docs for the session/dashboard details.
