# API Contracts

This app has **no REST or GraphQL API layer** — there are zero `route.ts` files under `src/app/`. All client-to-server calls go through Next.js **Server Actions**: async functions marked `"use server"`, colocated with the page that uses them in an `actions.ts` file (e.g. `src/app/contracts/[contractId]/actions.ts`, `src/app/lenders/[lenderId]/actions.ts`).

If a future task needs a true HTTP API (webhook receiver, external integration), that's a new pattern for this codebase — call it out explicitly in the task brief rather than quietly bolting on a `route.ts`.

## The Server Action Pattern

Actions are written to work with React's `useActionState` (form-bound), not as generic RPC:

```ts
export interface MakePaymentState {
  error?: string;
  success?: string;
}

export async function makePayment(
  contractId: string,
  _prevState: MakePaymentState | undefined,
  formData: FormData
): Promise<MakePaymentState> {
  // 1. Pull fields off FormData, by name, as strings
  // 2. Hand-validate and coerce (e.g. dollars -> integer cents), returning
  //    { error: "..." } on the first failure
  // 3. Look up the authenticated user (createClient() from lib/supabase/server)
  // 4. Delegate the actual mutation to src/server/*.ts (recordPayment, etc.)
  // 5. revalidatePath(...) and return { success: "..." }
}
```

Key conventions, observed directly in the code (`src/app/contracts/[contractId]/actions.ts` and siblings):

- **Input shape is `FormData`**, read field-by-field with `formData.get(name)` — no typed request body.
- **Validation is hand-rolled inline**, not schema-based. `zod` is a project dependency but is not actually imported anywhere under `src/` today — every action does its own manual type/range checks (`typeof x !== "string"`, `Number.isFinite(...)`, enum membership checks against Drizzle's generated `enumValues`). If a task adds meaningfully complex input validation, consider whether introducing a `zod` schema is in scope — but don't assume it's already a convention in use.
- **Money enters as dollars, is converted to integer cents immediately** at the action boundary (`Math.round(Number(amountDollars) * 100)`), before anything touches the domain or database layer. This is the actual API contract boundary for money — see `security.md`/`data-model.md` for why cents-as-integers matters.
- **Errors are returned, not thrown**, as `{ error: string }` in the state object the form re-renders with. Actions don't throw for expected validation failures; throwing is reserved for truly exceptional/unset-env-var cases (e.g. `db/client.ts` throws if `DATABASE_URL` is missing).
- **Actions call into `src/server/*.ts`** for anything beyond a simple field update — `recordPayment`/`reversePayment` (`src/server/payments.ts`), lender ledger operations (`src/server/lenderLedger.ts`), funding (`src/server/funding.ts`), vendor invoices (`src/server/vendorInvoices.ts`), check classification/extraction (`src/server/checkClassification.ts`, `checkExtraction.ts`). This is the actual "business API" — `src/app/**/actions.ts` is a thin adapter between form submissions and `src/server/`.
- **Auth is checked per-action**, not centrally for data mutations — each action that needs the current user calls `createClient()` (`src/lib/supabase/server.ts`) and reads `supabase.auth.getUser()`. Page-level auth is separately enforced by `src/proxy.ts` middleware (see `authentication.md`) — the middleware keeps unauthenticated users out of staff pages entirely, but an individual action deciding *who did this* still fetches the user itself.
- **Cache invalidation is explicit** via `revalidatePath(...)` after a successful mutation — there's no automatic revalidation.

## Implication for New Work

When a task adds a new mutation, the shape to follow is: `actions.ts` function bound to a form, manual validation returning `{error}`/`{success}`, delegation to a `src/server/` function for the actual write, `revalidatePath` on success. Don't introduce a parallel API-route-based pattern without a specific reason — it would be the first of its kind in this codebase.
