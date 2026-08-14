# Escrow Maintenance — Interaction Design

## Entry Points
- Route: `/escrow-maintenance` (`src/app/escrow-maintenance/page.tsx`), a single server component with no client-side interactivity.
- Reached from the internal sidebar as a top-level item ("Escrow Maintenance"), alongside "Tax Forms" and "Tax Bill Processing".
- No query params, filters, or sub-routes — it is a single, fully server-rendered page.

## Primary Flow
1. Staff navigate to `/escrow-maintenance`.
2. The server component (`getEscrowMaintenanceRows`) runs a series of queries for every `ACTIVE` contract: buyer name, reserve balance (`SUSPENSE` allocation sum), current monthly escrow payment (latest valid `ESCROW_TAX` allocation), current escrow/impound balance (latest `trust_ledger_entries.balance_cents`), and the full disbursement history needed to classify and total trailing-12-month tax/insurance amounts.
3. For each contract, `runEscrowAnalysis()` is called with the computed escrow balance, monthly payment, and projected annual tax/insurance totals (using the function's default 5% cushion / 12-month projection) to produce a `shortageOrSurplusCents` figure.
4. Rows are sorted alphabetically by contract number and rendered in a single sticky-header table, with two summary cards above it (Total Escrow Balance, Total Reserve Balance) and a page-level count ("N active land contracts…").
5. Staff scan the table for contracts with a shortage (shown in red, prefixed "Shortage") versus a surplus (shown in green, prefixed "Surplus").
6. Clicking a contract number navigates to that contract's detail page (`/contracts/{id}`) — from there, staff would separately navigate into that contract's Escrow Analysis tab to actually act on a flagged shortage.

## States & Transitions
- **Loading:** handled entirely by Next.js's default server-rendering — there's no explicit client loading spinner or skeleton state coded on this page.
- **Empty state:** if there are no active contracts, `getEscrowMaintenanceRows` returns `[]` early and the table renders with a "0 active land contracts…" header and no rows (no explicit "no data" message is shown, just an empty table body).
- **Missing escrow balance:** if a contract has no `trust_ledger_entries` row at all, `escrowBalanceCents` is `null` and `formatCents(null)` is displayed (renders as em dash per `formatCents`'s handling of null, based on usage elsewhere in the codebase) rather than `$0.00`.
- **No monthly escrow payment found:** defaults to `0` (not `null`), so a contract with no qualifying `ESCROW_TAX` history shows `$0.00` rather than a dash — this is visually indistinguishable from "genuinely collects $0/month."
- **Shortage vs. surplus styling:** `shortageOrSurplusCents > 0` renders red with the label "Shortage "; otherwise (including exactly `0`) renders green/emerald with the label "Surplus ".
- There is no error boundary or explicit error state coded on this page — a query failure would surface as an unhandled server error / Next.js error page.

## Secondary Flows / Edge Cases
- Contracts whose most recent `ESCROW_TAX` allocation is a `$0` `LEGACY_IMPORT` wash entry or a negative payoff refund are deliberately excluded from the "monthly payment" lookup (via `gt(paymentAllocations.amountCents, 0)`), falling back to whatever the next-most-recent qualifying entry is (or `0` if none exists) — this is a data-quality workaround for imported/legacy contracts, not a live edge case a user triggers.
- The trailing-12-month window is anchored per contract to that contract's own latest disbursement date rather than the current date, so contracts with old/stale disbursement history still get a meaningful (if outdated) trailing total instead of an empty one.
- Portfolio totals (`totalEscrowBalanceCents`, `totalReserveBalanceCents`) sum every row's value including contracts with `null`/`0` escrow balances (treated as `0` in the sum), so the totals always reflect all currently active contracts.

## Open Questions / Known Gaps
- **No hand-off into action.** A contract flagged with a large shortage links only to the general contract detail page, not directly to that contract's Escrow Analysis tab (`/contracts/{id}/escrow-analysis`) — staff must know to navigate there themselves to actually run and record a new analysis.
- **No sorting/filtering controls.** The table is always sorted by contract number; there's no way to sort by shortage size, filter to only shortages, or search — which somewhat undercuts its stated purpose as a triage tool for a large portfolio.
- **Cushion % and projection period are not adjustable here**, unlike the per-contract Escrow Analysis page — this dashboard always uses the domain defaults (5%, 12 months), so it can't preview "what if we used a different cushion" the way the per-contract page can.
- **No pagination.** All active contracts are queried and rendered in one page load inside a `max-h-[75vh] overflow-auto` scrolling table — for a very large portfolio this could become a performance concern, though nothing in the code currently limits or pages the result set.
- **"Monthly Payment: $0.00" is ambiguous** — it's not visually distinguished from a contract that has no escrow collection at all versus one whose real escrow data was filtered out by the legacy-import exclusion logic.
