"use client";

import { useActionState } from "react";
import {
  updateLenderPortalPin,
  deactivateLenderPortalAction,
  reactivateLenderPortalAction,
  type UpdateLenderPortalPinState,
  type SetLenderPortalDeactivatedState,
} from "../actions";
import { logInAsLenderAction } from "../../actions";
import { formatDateTime } from "@/lib/format";
import LogInAsNewWindowButton from "../../../_components/LogInAsNewWindowButton";

export default function OnlinePortalSection({
  lenderId,
  email,
  portalPin,
  portalDeactivated,
  portalLastLoginAt,
}: {
  lenderId: string;
  email: string | null;
  portalPin: string | null;
  portalDeactivated: boolean;
  portalLastLoginAt: Date | null;
}) {
  const pinAction = updateLenderPortalPin.bind(null, lenderId);
  const [pinState, pinFormAction, pinPending] = useActionState<UpdateLenderPortalPinState | undefined, FormData>(
    pinAction,
    undefined
  );

  const deactivateAction = deactivateLenderPortalAction.bind(null, lenderId);
  const [, deactivateFormAction, deactivatePending] = useActionState<SetLenderPortalDeactivatedState | undefined, FormData>(
    deactivateAction,
    undefined
  );
  const reactivateAction = reactivateLenderPortalAction.bind(null, lenderId);
  const [, reactivateFormAction, reactivatePending] = useActionState<SetLenderPortalDeactivatedState | undefined, FormData>(
    reactivateAction,
    undefined
  );

  const isSetUp = Boolean(email && portalPin);
  const statusLabel = portalDeactivated ? "Deactivated" : isSetUp ? "Active" : "Not Set Up";
  const statusClasses = portalDeactivated
    ? "bg-red-50 text-red-700 ring-red-600/20"
    : isSetUp
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
      : "bg-slate-100 text-slate-500 ring-slate-500/20";

  return (
    <div className="rounded-lg border border-slate-200 shadow-sm p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Online Portal</h3>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusClasses}`}>
          {statusLabel}
        </span>
      </div>

      <p className="mb-3 flex items-baseline justify-between text-sm">
        <span className="text-slate-500">Last Login</span>
        <span className="font-medium tabular-nums text-slate-900">
          {portalLastLoginAt ? formatDateTime(portalLastLoginAt) : "Never"}
        </span>
      </p>

      <form action={pinFormAction} className="mb-3 flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-slate-500" htmlFor="portalPin">
            Portal PIN
          </label>
          <input
            id="portalPin"
            name="portalPin"
            type="text"
            defaultValue={portalPin ?? ""}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={pinPending}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pinPending ? "..." : "Save"}
        </button>
      </form>
      {pinState?.success && <p className="mb-3 text-sm text-emerald-700">{pinState.success}</p>}

      <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
        <LogInAsNewWindowButton
          action={() => logInAsLenderAction(lenderId)}
          portalUrl={`/online-portals/lenders?as=${lenderId}`}
          disabled={portalDeactivated || !isSetUp}
        />

        {portalDeactivated ? (
          <form action={reactivateFormAction}>
            <button
              type="submit"
              disabled={reactivatePending}
              className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 hover:bg-emerald-100 disabled:opacity-50"
            >
              Reactivate
            </button>
          </form>
        ) : (
          <form action={deactivateFormAction}>
            <button
              type="submit"
              disabled={deactivatePending}
              className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20 hover:bg-red-100 disabled:opacity-50"
            >
              Deactivate
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
