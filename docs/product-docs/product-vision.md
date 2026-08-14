# Product Vision — SGMS Land Contract Servicing

## What This Is

An internal-only system of record for servicing land contracts — seller-financed real estate loans where a borrower buys a property directly from a contract holder over time, rather than through a bank mortgage. The app's own metadata describes it plainly: *"Internal land contract servicing system."*

The system exists to do, correctly and repeatably, the operational work a loan servicer is responsible for: tracking what's owed, applying payments, maintaining escrow reserves for taxes/insurance, splitting payments between the business and the outside investors who actually fund the contracts, and paying the vendors and lenders that need to get paid.

## Who It's For

- **Internal servicing staff** — the primary users. Gated behind Supabase auth (`src/proxy.ts`); this is where nearly all functionality lives (contracts, borrowers, lenders, vendors, payments, escrow, tax processing, reports, setup/admin).
- **Lenders** — external investors who fund land contracts, given limited self-service visibility through `/online-portals/lenders`, authenticated by a separate email+PIN session (not staff accounts). A single login can resolve to many lender entities (one analyst's credentials have been observed managing 25+ investor LLCs), so the portal lets a user pick which entity to view.
- **Borrowers** — given limited self-service visibility through `/online-portals/borrowers`.

*(Assumption worth confirming: the domain model — lenders as first-class entities with their own ledger, check register, and share-of-payment calculations — implies this business services contracts on behalf of outside investor-lenders rather than holding all contracts on its own balance sheet. If that's not an accurate read of the business model, the "lenders" vocabulary throughout this doc set should be revisited.)*

## Core Value Proposition

Reading the domain layer (`src/domain/`) as the ground truth for what this product is actually for, the job is to:

1. **Track the loan itself** — principal, rate, and amortization schedule per contract (`src/domain/amortization/`)
2. **Apply payments and calculate what's owed** — ledger math, next-payment-date advancement, amount-due calculation (`src/domain/ledger/`)
3. **Manage escrow reserves** — classify disbursements and run escrow analysis so property tax/insurance obligations get paid from the right funds (`src/domain/escrow/`)
4. **Split payments with investor-lenders** — calculate each lender's share of a given contract's activity (`src/domain/lending/`)
5. **Pay vendors and lenders** — check printing, check registers, and statement generation for both
6. **Handle tax-season obligations** — tax bill processing and tax form generation
7. **Let borrowers and lenders self-serve** — reduce staff load for basic account visibility
8. **Onboard contracts** — either manual entry or bulk import, including migrating historical data from a predecessor system

## Origin / Migration Context

This system replaced (or is replacing) a prior servicing setup. Historical loan and trust-ledger data was imported from an export format the codebase refers to as "TMO" (`scripts/parse-tmo-export.ts`, `scripts/import-tmo-data.ts`), cross-checked against legacy check registers and vendor statements (`import-data/`). Money precision matters enough here that the domain layer stores everything as whole cents at rest and only uses `Decimal` transiently for rate/amortization math (`src/domain/money.ts`) — a direct consequence of servicing real loans where rounding errors compound over years.

## What Success Looks Like

- The ledger is always auditable and reconciles to the cent
- Lender share distributions are correct — this is money owed to outside investors, not just internal bookkeeping
- Escrow and tax obligations are paid correctly and on time, with no borrower left under- or over-collected
- Borrowers and lenders can answer their own basic questions (balance, statements, payoff) without calling staff
- Staff can onboard a new contract, whether one at a time or in bulk, without manual data massaging outside the app
