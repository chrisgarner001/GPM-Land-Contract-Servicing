"use client";

import { useActionState } from "react";
import {
  updateBorrowerPortalPinAction,
  deactivateBorrowerPortalAction,
  reactivateBorrowerPortalAction,
  type UpdateBorrowerPortalPinState,
  type SetBorrowerPortalDeactivatedState,
} from "../actions";
import { logInAsBorrowerAction } from "../../actions";
import { formatDateTime } from "@/lib/format";
import LogInAsNewWindowButton from "../../../_components/LogInAsNewWindowButton";

export default function BorrowerOnlinePortalSection({
  partyId,
  contractId,
  borrowerPortalEmail,
  borrowerPortalPin,
  borrowerPortalDeactivated,
  borrowerPortalLastLoginAt,
}: {
  partyId: string;
  contractId: string | null;
  borrowerPortalEmail: string | null;
  borrowerPortalPin: string | null;
  borrowerPortalDeactivated: boolean;
  borrowerPortalLastLoginAt: Date | null;
}) {
  const pinAction = contractId ? updateBorrowerPortalPinAction.bind(null, partyId, contractId) : null;
  const [pinState, pinFormAction, pinPending] = useActionState<UpdateBorrowerPortalPinState | undefined, FormData>(
    pinAction ?? (async (s) => s),
    undefined
  );

  const deactivateAction = contractId ? deactivateBorrowerPortalAction.bind(null, partyId, contractId) : null;
  const [, deactivateFormAction, deactivatePending] = useActionState<SetBorrowerPortalDeactivatedState | undefined, FormData>(
    deactivateAction ?? (async (s) => s),
    undefined
  );
  const reactivateAction = contractId ? reactivateBorrowerPortalAction.bind(null, partyId, contractId) : null;
  const [, reactivateFormAction, reactivatePending] = useActionState<SetBorrowerPortalDeactivatedState | undefined, FormData>(
    reactivateAction ?? (async (s) => s),
    undefined
  );

  if (!contractId) {
    return (
      <div className="rounded-lg border border-slate-200 shadow-sm p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Online Portal</h3>
        <p className="text-sm text-slate-400">No land contract on file yet — nothing to set up.</p>
      </div>
    );
  }

  const isSetUp = Boolean(borrowerPortalEmail && borrowerPortalPin);
  const statusLabel = borrowerPortalDeactivated ? "Deactivated" : isSetUp ? "Active" : "Not Set Up";
  const statusClasses = borrowerPortalDeactivated
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
          {borrowerPortalLastLoginAt ? formatDateTime(borrowerPortalLastLoginAt) : "Never"}
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
            defaultValue={borrowerPortalPin ?? ""}
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
          action={() => logInAsBorrowerAction(contractId)}
          portalUrl="/online-portals/borrowers"
          disabled={borrowerPortalDeactivated || !isSetUp}
        />

        {borrowerPortalDeactivated ? (
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
