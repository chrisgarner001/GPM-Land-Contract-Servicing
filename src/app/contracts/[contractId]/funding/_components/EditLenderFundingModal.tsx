"use client";

import { useActionState, useEffect, useRef } from "react";
import { updateLenderFundingAction, type UpdateLenderFundingState } from "../actions";

export default function EditLenderFundingModal({
  contractId,
  contractPartyId,
  fundedAmountCents,
  interestRateAnnual,
  fundingDate,
}: {
  contractId: string;
  contractPartyId: string;
  fundedAmountCents: number | null;
  interestRateAnnual: string | null;
  fundingDate: string | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const action = updateLenderFundingAction.bind(null, contractId, contractPartyId);
  const [state, formAction, pending] = useActionState<UpdateLenderFundingState | undefined, FormData>(action, undefined);

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
        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Edit
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-full max-w-lg rounded-lg border border-slate-200 p-0 shadow-xl backdrop:bg-slate-900/40"
      >
        <form action={formAction}>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Edit Funding Details</h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4 p-5">
            <p className="text-xs text-slate-500">
              Corrects or backfills this lender&apos;s funded amount, rate, and date in place — this does not create a
              new funding record or change who the active lender is.
            </p>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500" htmlFor="fundedAmount">
                  Funded Amount ($)
                </label>
                <input
                  id="fundedAmount"
                  name="fundedAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  defaultValue={fundedAmountCents !== null ? (fundedAmountCents / 100).toFixed(2) : ""}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500" htmlFor="interestRate">
                  Interest Rate (%)
                </label>
                <input
                  id="interestRate"
                  name="interestRate"
                  type="number"
                  step="0.001"
                  min="0"
                  max="100"
                  required
                  defaultValue={interestRateAnnual ?? ""}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500" htmlFor="fundingDate">
                  Funding Date
                </label>
                <input
                  id="fundingDate"
                  name="fundingDate"
                  type="date"
                  required
                  defaultValue={fundingDate ?? today}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          </div>

          <div className="flex items-center justify-end border-t border-slate-200 px-5 py-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {pending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
