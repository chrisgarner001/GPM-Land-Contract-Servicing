# Tax Forms

## Purpose
**Not yet implemented.** The route exists and is linked from the internal navigation, but `src/app/tax-forms/page.tsx` currently renders only a static "Coming soon." message — there is no logic, data access, form, or server action behind it. Based solely on its name and the fact that this is a loan/land-contract servicing system, the intended purpose is presumably year-end tax document generation for borrowers (e.g. a 1098-style annual interest-paid statement) — but nothing in the code confirms this; it is inferred, not verified. A repo-wide search for tax-form-related terms (`1098`, `IRS`, `taxForm`) found no matches anywhere outside this one placeholder file.

## Users
Presumed internal servicing staff (it sits in the internal-only sidebar), but this cannot be confirmed since no behavior exists yet — nor is it confirmed whether generated forms (if built) would be distributed to borrowers via the borrower portal (`src/app/online-portals/borrowers`) or handled entirely outside the app (e.g. mailed).

## Core Capabilities
None implemented. The page component is:
```tsx
export default function TaxFormsPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-xl font-semibold text-slate-900">Tax Forms</h1>
      <p className="mt-2 text-sm text-slate-500">Coming soon.</p>
    </main>
  );
}
```
There is no `actions.ts`, no `_components/`, and no data fetching in this route.

## Data Touched
None directly. If built as a year-end interest-statement generator, it would presumably need to read:
- `payments` / `payment_allocations` — specifically `INTEREST` allocations, to total interest paid per contract per calendar year.
- `contracts` and `contractParties`/`parties` — to identify each borrower and their mailing/contact info.
None of this is currently wired to any tax-forms code; it is a plausible dependency, not an observed one.

## Key Constraints / Business Rules
None exist yet — there is no validation, no invariants, and no business logic to describe.

## Related Features
- Would presumably depend on the `payments`/`payment_allocations` ledger populated by **Bulk Payment** and the per-contract payment flow (both funnel through `src/domain/ledger/applyPayment.ts`, which tags interest allocations with type `INTEREST`).
- Sits alongside **Tax Bill Processing**, also unimplemented, in the sidebar's top-level navigation.
