# Tax Bill Processing

## Purpose
**Not yet implemented.** The route exists and is linked from the internal navigation, but `src/app/tax-bill-processing/page.tsx` currently renders only a static "Coming soon." message — there is no logic, data access, form, or server action behind it. Based solely on its name and its placement in the sidebar (grouped with "Tax Forms" and "Escrow Maintenance", just above/below them), the intended purpose is presumably to take incoming property tax bills and match them to the correct land contract / escrow (impound) account so they can be paid — but nothing in the code confirms this; it is inferred, not verified.

## Users
Presumed internal servicing staff (it sits in the internal-only sidebar alongside Escrow Maintenance and Tax Forms, with no borrower/lender portal equivalent), but this cannot be confirmed from the code since no user-facing behavior exists yet.

## Core Capabilities
None implemented. The page component is:
```tsx
export default function TaxBillProcessingPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-xl font-semibold text-slate-900">Tax Bill Processing</h1>
      <p className="mt-2 text-sm text-slate-500">Coming soon.</p>
    </main>
  );
}
```
There is no `actions.ts`, no `_components/`, and no data fetching in this route.

## Data Touched
None. No schema tables, domain modules, or server modules are referenced by this route.

- A repo-wide search confirmed `src/server/checkExtraction.ts` and `src/server/checkClassification.ts` (the vision-based check-reading modules used by Bulk Payment and the lender/vendor check registers) are **not** referenced anywhere in or near this feature — there is no evidence tax bills currently go through similar document-processing, despite the surface-level similarity to scanned checks.

## Key Constraints / Business Rules
None exist yet — there is no validation, no invariants, and no business logic to describe.

## Related Features
- Would presumably feed **Escrow Maintenance** and the per-contract **Escrow Analysis** page, both of which currently read tax/insurance disbursement history from `trust_ledger_entries` (populated today via `escrow_vouchers` and manual/imported entries, not via any tax-bill-matching workflow). If this feature is built out, it would likely need to write into `trust_ledger_entries` and/or `escrow_vouchers`.
- Sits alongside **Tax Forms**, also unimplemented, in the sidebar's top-level navigation — the two may be intended as a related pair (bills coming in vs. forms going out) but nothing in the code links them.
