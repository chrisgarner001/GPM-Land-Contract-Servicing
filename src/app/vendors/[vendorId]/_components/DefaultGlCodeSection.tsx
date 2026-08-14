"use client";

import { useActionState, useMemo } from "react";
import { updateVendorDefaultGlCode, type UpdateVendorDefaultGlCodeState } from "../actions";
import { GL_CODE_TYPE_LABELS } from "@/app/setup/gl-codes/glCodeTypeLabels";

interface GlCodeOption {
  code: string;
  description: string | null;
  type: string | null;
}

export default function DefaultGlCodeSection({
  vendorId,
  defaultGlCode,
  glCodeOptions,
}: {
  vendorId: string;
  defaultGlCode: string | null;
  glCodeOptions: GlCodeOption[];
}) {
  const action = updateVendorDefaultGlCode.bind(null, vendorId);
  const [state, formAction, pending] = useActionState<UpdateVendorDefaultGlCodeState | undefined, FormData>(action, undefined);

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
    <div className="max-w-sm rounded-lg border border-slate-200 shadow-sm p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Default GL Code</h3>
      <form action={formAction} className="flex items-end gap-2">
        <select
          name="glCode"
          defaultValue={defaultGlCode ?? ""}
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
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
