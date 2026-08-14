# Development Workflow

This describes the standard workflow for shipping work in `land-contract-servicing`, from scoped request to deployed code.

This is a **solo-maintained project on a single `main` branch**, with no CI pipeline and no ticket tracker. There is deliberately no PR ceremony, no Jira, and no monorepo-style branch automation here — don't invent any.

---

## Repository Model

Single Next.js package, not a monorepo:

```text
land-contract-servicing/
  src/
    app/       — Next.js App Router pages + colocated Server Actions (actions.ts)
    domain/    — pure business-logic functions, one *.test.ts per module
    server/    — orchestration/side-effecting code between domain and the DB
    db/        — Drizzle ORM schema + migrations
    lib/       — auth, encryption, formatting, session helpers
  docs/
    product-docs/   — durable product documentation (vision, features)
    system-docs/    — durable system/implementation documentation (this file and its siblings)
  tasks/           — transient per-task planning docs, deleted once the work ships
  import-data/     — sample/reference data used for one-time migration scripts
  scripts/         — one-off data import/analysis scripts (not part of the running app)
```

---

## Agent Flow

| Step | Owner | Output |
|------|-------|--------|
| 1. Scope | `/product` | `tasks/{task-name}/product-brief.md` (+ durable docs under `docs/product-docs/features/{name}/` for New Feature / Enhancement work) |
| 2. Plan & Implement | `/engineering` | `tasks/{task-name}/task-brief.md`, then the actual code change, then deletion of the task folder |
| 3. Deploy | Human | `git push` to `main` — Vercel's git integration deploys automatically |

There is no separate implementation handoff — `/engineering` both plans and builds. There is no separate release phase — this app deploys continuously from `main`.

---

## Step 1 — Scope With `/product`

Every non-trivial task starts with `/product`. It classifies the request (New Feature, Enhancement, Improvement, Bug Fix), writes `tasks/{task-name}/product-brief.md`, and — for New Feature or Enhancement work — first creates or updates durable docs under `docs/product-docs/features/{name}/` (`feature-brief.md`, `interaction-design.md`).

Everything commits directly; there's no PR gate at this step.

## Step 2 — Plan & Implement With `/engineering`

`/engineering` reads the product brief (and any referenced feature docs), writes `tasks/{task-name}/task-brief.md` (subtask breakdown, files to touch, architecture contracts to preserve, testing plan, DB migration notes if any), and presents it for **human approval before writing any code**.

Once approved, `/engineering` implements the change directly — no separate implementer. As the final step, it deletes the task folder:

```bash
git rm -r "tasks/{task-name}/"
git commit -m "chore: remove task folder for {task-name}"
```

## Step 3 — Deploy

This project is linked to Vercel (`.vercel/project.json`). Pushing to `main` triggers a deploy through Vercel's git integration. Because there's no CI gate in between, `/engineering` runs the full local test suite and a production build before handing back to the human, and always flags a push to `main` explicitly rather than doing it silently.

---

## Validation Expectations

There is no CI here — nothing else will catch a regression before it ships. This inverts the usual advice for CI-backed monorepos:

- Run targeted tests for whatever you touched as you go (`npx vitest run path/to/changed.test.ts`)
- **Before considering a task done, run the full suite** (`npm test`) and `npm run build` — both are cheap at this project's current size, and there is no CI safety net behind them
- Any change to `src/domain/` (money/ledger/amortization/escrow/lending math) must come with matching `*.test.ts` coverage — that layer has no other verification
- If root-level dependencies change, run `npm install` before testing

---

## Parallel Work

Not currently used — this is a solo project on one branch. If a task is large enough to warrant isolation, create a working branch (`task/{task-name}`) and merge it yourself when ready; there's no automation driving that, so treat it as a manual choice rather than a required convention.
