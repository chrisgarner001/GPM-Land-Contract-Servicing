"use client";

import { useActionState } from "react";
import { updateLenderDefaultBankAccount, type UpdateDefaultBankAccountState } from "../actions";

export default function DefaultBankAccountSection({
  lenderId,
  defaultBankAccountId,
  bankAccountOptions,
  preferredPaymentMethod,
}: {
  lenderId: string;
  defaultBankAccountId: string | null;
  bankAccountOptions: { id: string; label: string }[];
  preferredPaymentMethod: "CHECK" | "ACH" | null;
}) {
  const action = updateLenderDefaultBankAccount.bind(null, lenderId);
  const [state, formAction, pending] = useActionState<UpdateDefaultBankAccountState | undefined, FormData>(action, undefined);

  return (
    <div className="max-w-sm rounded-lg border border-slate-200 shadow-sm p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Default Bank Account</h3>
      <form action={formAction} className="space-y-2">
        <div className="flex items-end gap-2">
          <select
            name="bankAccountId"
            defaultValue={defaultBankAccountId ?? ""}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">None</option>
            {bankAccountOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="preferredPaymentMethod">
            Preferred Payment Method
          </label>
          <select
            id="preferredPaymentMethod"
            name="preferredPaymentMethod"
            defaultValue={preferredPaymentMethod ?? ""}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Check (default)</option>
            <option value="CHECK">Check</option>
            <option value="ACH">ACH</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "..." : "Save"}
        </button>
      </form>
      {state?.success && <p className="mt-2 text-sm text-emerald-700">{state.success}</p>}
    </div>
  );
}
