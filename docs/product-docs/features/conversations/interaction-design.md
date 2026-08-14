# Conversations — Interaction Design

## Entry Points
- `/conversations` (`src/app/conversations/page.tsx`). No Sidebar nav entry was found referencing this route (a grep of `Sidebar.tsx` for "conversations" turned up nothing), so as it stands the page is only reachable by typing the URL directly — it isn't linked from the main navigation.

## Primary Flow
There is no flow. The entire component is:

```
export default function ConversationsPage() {
  return (
    <main ...>
      <h1>Conversations</h1>
      <p>Coming soon.</p>
    </main>
  );
}
```

No data fetching, no server action, no client interactivity.

## States & Transitions
- Single static state only.

## Secondary Flows / Edge Cases
None exist in the current code.

## Open Questions / Known Gaps
- **Not linked in navigation.** Unlike Reports and Setup, "Conversations" has no entry in `src/app/_components/Sidebar.tsx`, so even once built it will need a nav link added for staff to discover it.
- **Relationship to `notes.ts` schema is unconfirmed.** `src/db/schema/notes.ts` already contains `contractNotes`, `partyNotes`, `partyEmails`, and `partyEmailDrafts` — a plausible data model for a "Conversations" feature (per-contract/per-party notes plus a synced email trail) — but nothing in `src/app/conversations/` references them yet. Whether "Conversations" is meant to be a unified view over those four tables, or something else entirely, is not determinable from the code and should be confirmed with product before building.
- **No AI/Anthropic involvement despite the SDK being present in the repo.** It would be easy to assume this feature uses `@anthropic-ai/sdk` (e.g. to classify or summarize borrower emails) given the dependency is installed and used for check-image OCR elsewhere (`src/server/checkExtraction.ts`), but there is no evidence of that in the conversations code — this should not be assumed without an explicit product decision.
