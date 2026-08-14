"use client";

import { useActionState, useState } from "react";
import { cancelContractAction, deleteContractAction, type CancelContractState, type DeleteContractState } from "../actions";

export default function DangerZoneCard({
  contractId,
  contractNumber,
  hasPayments,
}: {
  contractId: string;
  contractNumber: string;
  hasPayments: boolean;
}) {
  const cancelAction = cancelContractAction.bind(null, contractId);
  const [cancelState, cancelFormAction, cancelPending] = useActionState<CancelContractState | undefined, FormData>(cancelAction, undefined);

  const deleteAction = deleteContractAction.bind(null, contractId);
  const [deleteState, deleteFormAction, deletePending] = useActionState<DeleteContractState | undefined, FormData>(deleteAction, undefined);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [typedNumber, setTypedNumber] = useState("");

  return (
    <div className="rounded-lg border border-red-200 bg-red-50/40 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-red-700">Danger Zone</h3>

      <div className="flex items-center justify-between border-b border-red-100 pb-3">
        <div>
          <p className="text-sm font-medium text-slate-900">Cancel Contract</p>
          <p className="text-xs text-slate-500">Retires the contract — hidden from the active list, everything stays on record.</p>
        </div>
        <form action={cancelFormAction}>
          <button
            type="submit"
            disabled={cancelPending}
            onClick={(e) => {
              if (!confirm(`Cancel contract ${contractNumber}? It will be removed from the active list, but its full history stays on record.`)) {
                e.preventDefault();
              }
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {cancelPending ? "Cancelling..." : "Cancel Contract"}
          </button>
        </form>
      </div>
      {cancelState?.error && <p className="pt-2 text-sm text-red-600">{cancelState.error}</p>}

      <div className="flex items-center justify-between pt-3">
        <div>
          <p className="text-sm font-medium text-slate-900">Delete Permanently</p>
          <p className="text-xs text-slate-500">
            {hasPayments
              ? "This contract has recorded payments and can't be permanently deleted — use Cancel instead."
              : "Erases the contract and every related record — borrower, property, escrow history, everything. Cannot be undone."}
          </p>
        </div>
        {!confirmingDelete && (
          <button
            type="button"
            disabled={hasPayments}
            onClick={() => setConfirmingDelete(true)}
            className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Delete Permanently
          </button>
        )}
      </div>

      {confirmingDelete && !hasPayments && (
        <div className="mt-3 rounded-md border border-red-300 bg-white p-3">
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="confirmContractNumber">
            Type <span className="font-mono font-semibold text-slate-900">{contractNumber}</span> to confirm permanent deletion.
          </label>
          <input
            id="confirmContractNumber"
            type="text"
            value={typedNumber}
            onChange={(e) => setTypedNumber(e.target.value)}
            className="mb-3 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-red-500 focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <form action={deleteFormAction}>
              <button
                type="submit"
                disabled={typedNumber !== contractNumber || deletePending}
                className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deletePending ? "Deleting..." : "Permanently Delete"}
              </button>
            </form>
            <button
              type="button"
              onClick={() => {
                setConfirmingDelete(false);
                setTypedNumber("");
              }}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {deleteState?.error && <p className="mt-2 text-sm text-red-600">{deleteState.error}</p>}
    </div>
  );
}
