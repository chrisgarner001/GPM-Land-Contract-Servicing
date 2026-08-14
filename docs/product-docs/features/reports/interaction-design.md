# Reports — Interaction Design

## Entry Points
- `/reports` — top-level Sidebar nav item ("Reports", no sub-items), `src/app/_components/Sidebar.tsx` line ~49. Behind the staff auth gate, same as the rest of the internal app.

## Primary Flow
There is no flow to describe. `src/app/reports/page.tsx` is a server component that renders a static heading and a "Coming soon." paragraph — no data fetch, no interactive elements, no server action.

```
export default function ReportsPage() {
  return (
    <main ...>
      <h1>Reports</h1>
      <p>Coming soon.</p>
    </main>
  );
}
```

## States & Transitions
- Only one state: the static placeholder. No loading, empty, error, or success states exist because there is no data or interaction.

## Secondary Flows / Edge Cases
None — nothing beyond the single static render.

## Open Questions / Known Gaps
- The entire feature is unbuilt. It's unclear from the code what specific reports are planned (e.g. delinquency, portfolio summary, lender payout summary, escrow analysis) — nothing in `src/app/reports/` or elsewhere hints at a planned report list or data shape. This should be clarified with product/stakeholders before implementation starts, since the answer materially affects which domain modules and schema tables it would need to read.
