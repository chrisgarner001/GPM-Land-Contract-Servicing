# Setup

## Purpose
Internal administrative configuration area for the servicing system: a reference list of staff users, the chart of GL codes used to classify vendor invoices, and the company's own bank accounts (operating, escrow, owner trust) used for check printing and as default payout accounts. It exists so the rest of the app (invoice entry, check printing, lender/vendor payout defaults) has consistent, centrally-managed reference data instead of free text.

## Users
Internal staff only, behind the standard Supabase auth gate (`src/proxy.ts`). Setup itself has no per-role restriction visible in the code — `staffUsers.role` (ADMIN/STAFF) is stored but not read anywhere in the `setup` action files to gate who can add/remove records; it's purely a reference field ("who's on the team, their role, how to reach them" per the schema comment).

## Core Capabilities
- **Setup home** (`/setup`): a directory linking to Users, GL Codes, and Bank Accounts sections.
- **Users** (`/setup/users`): view a list of staff (name, email, role) sorted by name; add a new staff reference row (name, email, role defaulting to STAFF). No edit or delete action exists.
- **GL Codes** (`/setup/gl-codes`): view a list of GL codes (code, description, type) sorted by code; add a new GL code with a required unique `code`, optional description, and optional type (Income / Expense / Bank / Current Asset / Current Liability / Equity). No edit or delete action exists.
- **Bank Accounts** (`/setup/bank-accounts`): view a list of bank accounts (label, bank name, routing #, masked account #, notes) sorted by label; add a new bank account; reveal/hide the full (decrypted) account number on demand per row; remove a bank account (which first un-assigns any vendor/lender currently defaulting to it, then deletes the row).

## Data Touched
- `staffUsers` (`src/db/schema/setup.ts`) — read (list) and insert (add). Explicitly documented as a reference list only — "Does not control real login access; that's managed directly in the Supabase dashboard."
- `glCodes` (`src/db/schema/setup.ts`) — read (list) and insert (add), with a uniqueness check on `code` enforced in `addGlCode` before insert (in addition to the DB-level `unique()` constraint). Feeds the GL-code select on the Vendors > New Invoice form (per schema comment); `addGlCode`'s server action also revalidates `/vendors/new-invoice`.
- `bankAccounts` (`src/db/schema/setup.ts`) — read (list), insert (add), update (implicitly, via `removeBankAccount` nulling out references elsewhere), delete (remove). Account numbers are AES-256-GCM encrypted via `src/lib/encryption.ts` (`encryptPII`/`decryptPII`); only the last 4 digits are stored in plaintext for list display, matching the same treatment as `parties.achAccountNumberEncrypted`.
- `vendors` and `parties` tables — `removeBankAccount` nulls out `vendors.defaultBankAccountId` and `parties.defaultBankAccountId` for any row pointing at the bank account being deleted, inside the same DB transaction as the delete, to avoid an FK violation.

## Key Constraints / Business Rules
- GL code uniqueness is enforced both at the application layer (`addGlCode` checks for an existing row with the same trimmed code before inserting) and at the schema layer (`glCodes.code` has a `unique()` constraint).
- Bank account deletion is transactional: unassigning `vendors.defaultBankAccountId` / `parties.defaultBankAccountId` and deleting the `bankAccounts` row happen inside one `db.transaction`, with a client-side `confirm()` prompt before the delete is triggered ("Remove the ... bank account? Any vendor or lender currently defaulting to it will be unassigned.").
- Bank account numbers are never sent to the client in plaintext on initial page load — only `accountNumberLast4` is part of the list query; the full number is fetched on demand via the `revealBankAccountNumber` server action only when a user clicks "Reveal."
- All three "add" server actions revalidate their own list path; `addBankAccount` and `removeBankAccount` also revalidate `/vendors` and `/lenders` since those pages likely show bank-account defaults; `addGlCode` also revalidates `/vendors/new-invoice`.
- Minimal validation: Users requires name + email (role defaults to STAFF if an invalid value is submitted); GL Codes requires a non-empty code (type falls back to `null`/"None" if invalid); Bank Accounts requires a non-empty label (all other fields optional).

## Related Features
- **Vendors** (`src/app/vendors/`) — consumes `glCodes` for invoice classification and `bankAccounts` for default payout account.
- **Lenders** (`src/app/lenders/`) — consumes `bankAccounts` for `parties.defaultBankAccountId` (which trust account a lender is normally paid from).
- **Online Portals (lenders)** — indirectly related via `parties`, though the portal itself doesn't surface bank account data.
- Uses `src/lib/encryption.ts` for PII encryption, the same module used for `parties.achAccountNumberEncrypted` / `taxIdEncrypted`.
