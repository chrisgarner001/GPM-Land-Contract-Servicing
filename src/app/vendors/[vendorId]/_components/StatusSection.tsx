"use client";

import { useActionState } from "react";
import { deactivateVendorAction, reactivateVendorAction, type SetVendorDeactivatedState } from "../actions";

export default function StatusSection({ vendorId, deactivated }: { vendorId: string; deactivated: boolean }) {
  const deactivateAction = deactivateVendorAction.bind(null, vendorId);
  const [, deactivateFormAction, deactivatePending] = useActionState<SetVendorDeactivatedState | undefined, FormData>(
    deactivateAction,
    undefined
  );
  const reactivateAction = reactivateVendorAction.bind(null, vendorId);
  const [, reactivateFormAction, reactivatePending] = useActionState<SetVendorDeactivatedState | undefined, FormData>(
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
          ? "This vendor is deactivated — hidden from the Vendors list and the New Invoice vendor picker."
          : "Deactivating removes this vendor from the Vendors list and the New Invoice picker. Disbursement history stays intact."}
      </p>
      {deactivated ? (
        <form action={reactivateFormAction}>
          <button
            type="submit"
            disabled={reactivatePending}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {reactivatePending ? "Reactivating..." : "Reactivate Vendor"}
          </button>
        </form>
      ) : (
        <form action={deactivateFormAction}>
          <button
            type="submit"
            disabled={deactivatePending}
            className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {deactivatePending ? "Deactivating..." : "Deactivate Vendor"}
          </button>
        </form>
      )}
    </div>
  );
}
