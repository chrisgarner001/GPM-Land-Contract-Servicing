"use client";

import { useActionState, useMemo } from "react";
import { addVendor, type AddVendorState } from "../actions";
import { GL_CODE_TYPE_LABELS } from "@/app/setup/gl-codes/glCodeTypeLabels";

interface GlCodeOption {
  code: string;
  description: string | null;
  type: string | null;
}

export default function AddVendorForm({ glCodeOptions }: { glCodeOptions: GlCodeOption[] }) {
  const [state, formAction, pending] = useActionState<AddVendorState | undefined, FormData>(addVendor, undefined);

  const glCodeGroups = useMemo(() => {
    const groups = new Map<string, GlCodeOption[]>();
    for (const g of glCodeOptions) {
      const key = g.type ? GL_CODE_TYPE_LABELS[g.type] ?? g.type : "Uncategorized";
      const list = groups.get(key) ?? [];
      list.push(g);
      groups.set(key, list);
    }
    return Array.from(groups.entries());
  }, [glCodeOptions]);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-slate-200 shadow-sm bg-white p-6">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="vendorAccountCode">
          Account Code
        </label>
        <input
          id="vendorAccountCode"
          name="vendorAccountCode"
          type="text"
          required
          placeholder="e.g. AAAINS"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="displayName">
          Vendor Name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="referenceLine">
          Reference / Policy #
        </label>
        <input
          id="referenceLine"
          name="referenceLine"
          type="text"
          placeholder="e.g. Re: Policy # ABC123"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="addressLine1">
          Address
        </label>
        <input
          id="addressLine1"
          name="addressLine1"
          type="text"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="cityStateZip">
          City, State ZIP
        </label>
        <input
          id="cityStateZip"
          name="cityStateZip"
          type="text"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="defaultGlCode">
          Default GL Code
        </label>
        <select
          id="defaultGlCode"
          name="defaultGlCode"
          defaultValue=""
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">None</option>
          {glCodeGroups.map(([groupLabel, codes]) => (
            <optgroup key={groupLabel} label={groupLabel}>
              {codes.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.code}
                  {g.description ? ` — ${g.description}` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-400">Pre-selected on New Invoice when this vendor is chosen — still editable there.</p>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {pending ? "Saving..." : "Add Vendor"}
      </button>
    </form>
  );
}
