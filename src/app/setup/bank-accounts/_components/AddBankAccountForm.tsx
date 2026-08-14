"use client";

import { useActionState } from "react";
import { addBankAccount, type AddBankAccountState } from "../actions";

export default function AddBankAccountForm() {
  const [state, formAction, pending] = useActionState<AddBankAccountState | undefined, FormData>(addBankAccount, undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="label">
          Label
        </label>
        <input
          id="label"
          name="label"
          type="text"
          required
          placeholder="e.g. Operating"
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="bankName">
          Bank Name
        </label>
        <input
          id="bankName"
          name="bankName"
          type="text"
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="routingNumber">
          Routing Number
        </label>
        <input
          id="routingNumber"
          name="routingNumber"
          type="text"
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="accountNumber">
          Account Number
        </label>
        <input
          id="accountNumber"
          name="accountNumber"
          type="text"
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="notes">
          Notes
        </label>
        <input
          id="notes"
          name="notes"
          type="text"
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div className="flex items-end sm:col-span-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Adding..." : "Add Bank Account"}
        </button>
      </div>
      {state?.error && <p className="text-sm text-red-600 sm:col-span-3">{state.error}</p>}
    </form>
  );
}
