# Escrow Maintenance

## Purpose
A portfolio-wide, read-only dashboard that gives servicing staff a single view of every active land contract's escrow health: current impound (escrow) balance, held reserve balance, projected trailing-12-month property tax and insurance disbursements, the current monthly escrow collection, and a projected shortage or surplus against the business's target cushion. It exists so staff can triage which contracts likely need a formal escrow analysis, without opening each contract individually.

## Users
Internal servicing staff only (reached from the internal sidebar, not exposed to borrowers or lenders via their portals).

## Core Capabilities
- Lists every `ACTIVE` land contract with its contract number and buyer (borrower) name.
- Shows each contract's current escrow/impound balance, sourced from the latest `trust_ledger_entries.balance_cents` row (the same authoritative running balance TMO itself tracked).
- Shows each contract's current reserve balance — the running sum of `SUSPENSE`-type payment allocations (payments held because they didn't satisfy a full scheduled payment).
- Shows the contract's current monthly escrow payment — the most recent cleared, non-reversed, positive `ESCROW_TAX` payment allocation.
- Computes trailing-12-month projected annual tax and insurance disbursement totals per contract, using `classifyDisbursement()` to bucket each disbursement's description/payee text as TAX, INSURANCE, or OTHER.
- Runs `runEscrowAnalysis()` (default 5% cushion, 12-month projection) per contract to produce a projected shortage (red) or surplus (green), displayed per row.
- Shows portfolio-level totals: total escrow balance and total reserve balance summed across all active contracts.
- Each contract number links through to that contract's detail page (`/contracts/{id}`).

## Data Touched
- **Reads only** — this feature performs no writes.
- `contracts`, `contract_parties`, `parties` (active contract list + buyer names).
- `payments`, `payment_allocations` (reserve balance via `SUSPENSE` allocations; monthly escrow payment via `ESCROW_TAX` allocations).
- `trust_ledger_entries` (escrow/impound balance and the raw disbursement history used for classification).
- **Domain logic used:** `src/domain/escrow/classifyDisbursement.ts`, `src/domain/escrow/runEscrowAnalysis.ts`.

## Key Constraints / Business Rules
- Only `ACTIVE` contracts are included; contracts that are paid off, in default, etc. do not appear.
- The "monthly escrow payment" figure explicitly excludes `$0` `LEGACY_IMPORT` wash entries and negative/zero payoff-refund allocations — the code comments note that over half of migrated contracts' most recent `ESCROW_TAX` row is one of these non-recurring entries, and including them would produce negative or misleading "Monthly Payment" values.
- The trailing-12-month window is anchored to each contract's own most recent disbursement date, not to "today" — because historical/imported dates don't line up with the current calendar, using "today" would make the trailing window miss real disbursements.
- Escrow balance / escrow payment lookups use identical tie-breaking rules (`ORDER BY date DESC, id DESC`) to the per-contract Escrow Analysis page and the land-contract detail page — the code comments call this out explicitly so all three pages agree on the same numbers for a given contract.
- The cushion target is fixed at this page to the business's default policy — a flat 5% buffer on projected annual tax + insurance disbursements over a 12-month projection — matching the land contract's own methodology (land contracts aren't subject to RESPA's 1/6-cushion rule). Unlike the per-contract Escrow Analysis page, this dashboard does not let staff override the cushion percent or projection period; it always uses the domain function's defaults.
- Money is handled in whole cents throughout; `Decimal` is used only transiently inside `runEscrowAnalysis` for the cushion/rounding math.

## Related Features
- **Distinct from, but built on the same domain logic as, the per-contract Escrow Analysis page** (`/contracts/[contractId]/escrow-analysis`). Escrow Maintenance is an ephemeral, computed-on-every-page-load, portfolio-wide snapshot that writes nothing to the database. The per-contract Escrow Analysis page is the actual workflow used to *run and persist* a formal analysis for one contract — it lets staff adjust the trigger reason, projected tax/insurance, current balance/payment, cushion %, and projection period, and on submit inserts a permanent row into `escrow_analyses` (visible afterward in that page's "Past Analyses" history). Escrow Maintenance links to the contract detail page, not directly into that contract's Escrow Analysis tab — there is no one-click hand-off from a flagged shortage row into running the actual analysis.
- Shares its escrow-balance and monthly-escrow-payment sourcing logic, and its tax/insurance classification (`classifyDisbursement`), with the per-contract Escrow Analysis page, keeping the two consistent for the same contract.
- Depends on `trust_ledger_entries` data, which is populated by escrow disbursement activity (e.g. from `escrow_vouchers`); this dashboard does not itself process incoming tax bills — see **Tax Bill Processing**, which is a separate, currently unbuilt feature area.
