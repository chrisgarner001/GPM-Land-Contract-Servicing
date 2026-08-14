# Data Model & Domain Layer

## Schema (Drizzle ORM, PostgreSQL)

`src/db/schema/index.ts` barrel-exports one file per domain area:

| File | Covers |
|---|---|
| `parties.ts` | Borrowers, lenders, vendors — people/entities the system tracks |
| `contracts.ts` | The land contract itself — the core entity |
| `amortization.ts` | Amortization schedule data |
| `payments.ts` | Payment records, including the `paymentMethodEnum` used across the app |
| `escrow.ts` | Escrow reserve balances/transactions |
| `lending.ts` | Lender funding relationships and share calculations |
| `notes.ts` | Free-text notes attached to entities (e.g. `contractNotes`) |
| `vendors.ts` | Vendor-specific fields beyond the shared party record |
| `checks.ts` | Check issuance/register data (lender and vendor checks) |
| `setup.ts` | Admin/configuration data — bank accounts, GL codes, users |
| `charges.ts` | Fees/charges (e.g. late fees) applied to a contract |

Migrations live in `src/db/migrations/`, generated via `npx drizzle-kit generate` and applied via `npx drizzle-kit push` (see root `package.json` scripts `db:generate` / `db:push`). `drizzle.config.ts` points schema generation at `src/db/schema/index.ts` and loads `DATABASE_URL` from `.env.local`.

## Domain Layer (`src/domain/`)

Pure, side-effect-free business logic, each function with a co-located `*.test.ts`:

- **`amortization/`** — `generateSchedule`, `calculatePayoffQuote`
- **`ledger/`** — `applyPayment`, `calculateAmountDue`, `advanceNextPaymentDate`
- **`escrow/`** — `classifyDisbursement`, `runEscrowAnalysis`
- **`lending/`** — `calculateLenderShare`
- **`money.ts`** — the shared money convention (see below)

This is the layer with the highest correctness bar in the app — it's the actual loan math. New business logic belongs here as a pure, tested function, not inlined into a Server Action or `src/server/*.ts` file.

## Money Convention

**Money is stored as whole cents (integers) at rest and at every domain/API boundary.** `decimal.js` (`Decimal`) is used only transiently, inside rate and amortization math where fractional-cent precision matters mid-calculation — every function in `src/domain/money.ts` takes or returns cents (`number`), converting to/from `Decimal` internally:

```ts
centsToDecimal(cents: number): Decimal        // cents -> Decimal dollars, for math
decimalToCents(value: Decimal): number        // Decimal dollars -> whole cents, ROUND_HALF_UP
annualRateToMonthlyDecimal(pct: number): Decimal
annualRateToDailyDecimal365(pct: number): Decimal
```

Server Actions convert user-entered dollars to cents immediately at the boundary (`Math.round(Number(amountDollars) * 100)`) before anything touches `src/domain/` or the database — see `api-contracts.md`. **Never introduce a code path that stores or passes money as a floating-point dollar amount** — convert to cents at the earliest possible point.

## `src/server/` — Orchestration Layer

Sits between Server Actions and the domain layer; this is where domain functions get combined with database reads/writes:

- `payments.ts` — `recordPayment`, `reversePayment`
- `funding.ts` — contract funding operations
- `lenderLedger.ts` — lender-side ledger operations
- `vendorInvoices.ts` — vendor invoice handling
- `checkClassification.ts`, `checkExtraction.ts` — check document processing

If you're unsure whether new logic belongs in `src/domain/` or `src/server/`: if it's pure computation with no I/O, it's `domain/`; if it reads/writes the database or coordinates multiple domain functions, it's `server/`.
