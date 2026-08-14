"use client";

import { useActionState } from "react";
import { addGlCode, type AddGlCodeState } from "../actions";
import { GL_CODE_TYPE_OPTIONS } from "../glCodeTypeLabels";

export default function AddGlCodeForm() {
  const [state, formAction, pending] = useActionState<AddGlCodeState | undefined, FormData>(addGlCode, undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="code">
          Code
        </label>
        <input
          id="code"
          name="code"
          type="text"
          required
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="description">
          Description
        </label>
        <input
          id="description"
          name="description"
          type="text"
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="type">
          Type
        </label>
        <select
          id="type"
          name="type"
          defaultValue=""
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">None</option>
          {GL_CODE_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Adding..." : "Add GL Code"}
        </button>
      </div>
      {state?.error && <p className="col-span-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
