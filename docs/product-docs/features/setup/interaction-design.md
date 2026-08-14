# Setup — Interaction Design

## Entry Points
- `/setup` — Sidebar nav item "Setup", with children "Users", "GL Codes", "Bank Accounts" (`src/app/_components/Sidebar.tsx`). The `/setup` page itself (`src/app/setup/page.tsx`) is a static directory of three cards (href, label, description) linking into each sub-section.
- `/setup/users`, `/setup/gl-codes`, `/setup/bank-accounts` — each has a "← Setup" back-link at the top.

## Primary Flow — Users
1. Staff opens `/setup/users`; the page (server component) queries `staffUsers` ordered by `name` and renders a table (Name, Email, Role) or "No users on record yet." if empty.
2. Staff fills the `AddStaffUserForm` (Name, Email, Role select defaulting to "Staff") and submits — this calls `addStaffUser` via `useActionState`.
3. Server validates `name` and `email` are non-empty (trimmed); `role` is coerced to a valid enum value or defaults to `"STAFF"` if garbage/missing.
4. On success, `revalidatePath("/setup/users")` refreshes the list; on failure (`error` set), the message renders in red under the form; submit button shows "Adding..." while pending.

## Primary Flow — GL Codes
1. Staff opens `/setup/gl-codes`; queries `glCodes` ordered by `code`, renders a table (Code, Description, Type — using `GL_CODE_TYPE_LABELS` to map enum values to display labels) or an empty-state row.
2. Staff fills `AddGlCodeForm` (Code required, Description optional, Type select with a "None" default) and submits — calls `addGlCode`.
3. Server checks `code` is non-empty, then queries for an existing row with the same trimmed code; if found, returns `{ error: 'GL code "X" already exists.' }` without inserting. Type value is validated against `glCodeTypeEnum.enumValues`, else stored as `null`.
4. On success, revalidates `/setup/gl-codes` and `/vendors/new-invoice` (since the new code should immediately be selectable there).

## Primary Flow — Bank Accounts
1. Staff opens `/setup/bank-accounts`; queries `bankAccounts` ordered by `label`, renders `BankAccountsList` (Label, Bank, Routing #, Account # [masked], Notes, Remove) or an empty-state message.
2. Staff fills `AddBankAccountForm` (Label required; Bank Name, Routing Number, Account Number, Notes all optional) and submits — calls `addBankAccount`.
3. Server requires non-empty `label`; if an account number is supplied, it's AES-256-GCM encrypted (`encryptPII`) for storage and the last 4 digits are stored separately in plaintext for display.
4. On success, revalidates `/setup/bank-accounts`, `/vendors`, and `/lenders`.
5. **Reveal account number**: clicking "Reveal" next to a masked `••••1234` value calls the `revealBankAccountNumber` server action directly (not a form submit) with the account's id; while awaiting, the button shows "..."; on response, the button flips to "Hide" and the full number replaces the masked value. Clicking "Hide" toggles it back to masked without a fresh server call (client-only state).
6. **Remove a bank account**: clicking "Remove" first shows a native `confirm()` dialog naming the account label and warning that defaulting vendors/lenders will be unassigned; on confirm, `removeBankAccount(id)` runs inside a `useTransition`, showing "Removing..." while pending. The server action nulls out any `vendors.defaultBankAccountId` / `parties.defaultBankAccountId` pointing at this account, then deletes the row, all in one DB transaction.

## States & Transitions
- **Empty list** states are handled explicitly in all three sections ("No users on record yet.", "No GL codes on record yet.", "No bank accounts on record yet.").
- **Pending submit**: all three add-forms disable their submit button and swap its label to an "-ing..." variant while `useActionState`'s `pending` is true.
- **Validation failure**: each action returns `{ error: string }`, rendered inline below the form in red text; the form is not cleared.
- **GL code duplicate**: distinct error path (existing-code lookup) beyond simple required-field validation.
- **Bank account reveal/hide**: client-only toggle state (`useState`) per row, independent per row, calling the server only on the first reveal (result isn't cached beyond that render — hiding and re-revealing calls the server again).
- **Bank account removal confirmation**: a blocking native `confirm()` — declining leaves the row untouched with no server call made.

## Secondary Flows / Edge Cases
- `addGlCode`'s duplicate check and insert are not wrapped in a single transaction/unique-constraint race guard beyond the DB's own `unique()` on `code` — a concurrent double-submit could theoretically still hit a DB-level unique violation that isn't caught as a friendly error (not explicitly handled in the action).
- `removeBankAccount` has no equivalent for GL codes or staff users — those two entities have no delete/remove action at all, only add.
- `staffUsers.role` is captured but not used anywhere in these files to restrict any Setup action — it is purely informational per the schema's own comment.

## Open Questions / Known Gaps
- **No edit capability anywhere in Setup.** Users, GL Codes, and Bank Accounts can only be added (bank accounts can also be removed); there's no way to fix a typo in a staff member's email or a GL code's description short of going around the UI.
- **No delete for Users or GL Codes**, unlike Bank Accounts — inconsistent CRUD surface across the three sections. Could be intentional (avoid breaking historical references to a GL code on old invoices) but isn't stated anywhere in code.
- **`staffUsers.role` currently has no effect on permissions** in the code reviewed — worth flagging if the product intent is for ADMIN vs STAFF to actually gate access somewhere.
- **Reveal account number has no audit trail** visible in the code — no logging of who revealed a bank account number or when, despite it being sensitive encrypted data.
