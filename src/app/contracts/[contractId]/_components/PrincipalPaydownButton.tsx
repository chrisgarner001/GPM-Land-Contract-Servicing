"use client";

import { useActionState, useEffect, useRef } from "react";
import { recordPrincipalPaydownAction, type RecordPrincipalPaydownState } from "../actions";
import { formatCents } from "@/lib/format";

export default function PrincipalPaydownButton({
  contractId,
  eligible,
  ineligibleReason,
  currentPrincipalBalanceCents,
}: {
  contractId: string;
  eligible: boolean;
  ineligibleReason: string | null;
  currentPrincipalBalanceCents: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const action = recordPrincipalPaydownAction.bind(null, contractId);
  const [state, formAction, pending] = useActionState<RecordPrincipalPaydownState | undefined, FormData>(action, undefined);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (state?.success) {
      dialogRef.current?.close();
    }
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
      >
        Principal Paydown
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-full max-w-lg rounded-lg border border-slate-200 p-0 shadow-xl backdrop:bg-slate-900/40"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Principal Paydown</h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-5">
          <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-600/20">
            Principal Paydown is only allowed when no interest, escrow, or other charges are due.
          </p>

          {!eligible ? (
            <p className="text-sm text-red-600">{ineligibleReason}</p>
          ) : (
            <form action={formAction} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500" htmlFor="receivedDate">
                    Date
                  </label>
                  <input
                    id="receivedDate"
                    name="receivedDate"
                    type="date"
                    required
                    defaultValue={today}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500" htmlFor="paymentMethod">
                    Method
                  </label>
                  <select
                    id="paymentMethod"
                    name="paymentMethod"
                    defaultValue="CHECK"
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="CHECK">Check</option>
                    <option value="CASH">Cash</option>
                    <option value="ACH">ACH</option>
                    <option value="CARD">Card</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-500" htmlFor="amount">
                  Principal Amount ($)
                </label>
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={(currentPrincipalBalanceCents / 100).toFixed(2)}
                  required
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Outstanding principal balance: {formatCents(currentPrincipalBalanceCents)}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-500" htmlFor="referenceNumber">
                  Reference #
                </label>
                <input
                  id="referenceNumber"
                  name="referenceNumber"
                  type="text"
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

              <div className="flex items-center justify-end border-t border-slate-100 pt-3">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {pending ? "Recording..." : "Record Paydown"}
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
