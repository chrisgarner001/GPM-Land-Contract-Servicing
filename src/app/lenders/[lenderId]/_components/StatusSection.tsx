"use client";

import { useActionState } from "react";
import { deactivateLenderAction, reactivateLenderAction, type SetLenderDeactivatedState } from "../actions";

export default function StatusSection({ lenderId, deactivated }: { lenderId: string; deactivated: boolean }) {
  const deactivateAction = deactivateLenderAction.bind(null, lenderId);
  const [, deactivateFormAction, deactivatePending] = useActionState<SetLenderDeactivatedState | undefined, FormData>(
    deactivateAction,
    undefined
  );
  const reactivateAction = reactivateLenderAction.bind(null, lenderId);
  const [, reactivateFormAction, reactivatePending] = useActionState<SetLenderDeactivatedState | undefined, FormData>(
    reactivateAction,
    undefined
  );

  return (
    <div className="rounded-lg border border-slate-200 shadow-sm p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</h3>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
            deactivated ? "bg-slate-100 text-slate-500 ring-slate-500/20" : "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
          }`}
        >
          {deactivated ? "Deactivated" : "Active"}
        </span>
      </div>
      <p className="mb-3 text-sm text-slate-500">
        {deactivated
          ? "This lender is deactivated — hidden from the Lenders list and can't be assigned new funding. Portal login stays blocked until reactivated separately below."
          : "Deactivating removes this lender from the Lenders list and \"Existing Lender\" pickers, and blocks portal login. Nothing else is affected — funding history stays intact."}
      </p>
      {deactivated ? (
        <form action={reactivateFormAction}>
          <button
            type="submit"
            disabled={reactivatePending}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {reactivatePending ? "Reactivating..." : "Reactivate Lender"}
          </button>
        </form>
      ) : (
        <form action={deactivateFormAction}>
          <button
            type="submit"
            disabled={deactivatePending}
            className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {deactivatePending ? "Deactivating..." : "Deactivate Lender"}
          </button>
        </form>
      )}
    </div>
  );
}
