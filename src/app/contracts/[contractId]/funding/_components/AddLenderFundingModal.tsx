"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addLenderFundingAction, type AddLenderFundingState } from "../actions";

export default function AddLenderFundingModal({
  contractId,
  existingLenders,
}: {
  contractId: string;
  existingLenders: { id: string; displayName: string }[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const action = addLenderFundingAction.bind(null, contractId);
  const [state, formAction, pending] = useActionState<AddLenderFundingState | undefined, FormData>(action, undefined);

  const today = new Date().toISOString().slice(0, 10);
  const [lenderMode, setLenderMode] = useState<"existing" | "new">("existing");

  function resetFields() {
    setLenderMode("existing");
  }

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
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Add Lender
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-full max-w-lg rounded-lg border border-slate-200 p-0 shadow-xl backdrop:bg-slate-900/40"
        onClose={resetFields}
      >
        <form action={formAction} className="max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Add Lender Funding</h2>
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
              A 100% funding replaces the current lender(s) going forward — their active share is closed out as of
              the funding date below. A lower percent instead scales the existing lender(s) down proportionally, so
              multiple lenders can hold a genuine simultaneous split.
            </p>

            <div>
              <div className="mb-2 flex gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="lenderMode"
                    value="existing"
                    checked={lenderMode === "existing"}
                    onChange={() => setLenderMode("existing")}
                  />
                  Existing Lender
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="lenderMode"
                    value="new"
                    checked={lenderMode === "new"}
                    onChange={() => setLenderMode("new")}
                  />
                  New Lender
                </label>
              </div>

              {lenderMode === "existing" ? (
                <select
                  name="existingPartyId"
                  required
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select a lender…
                  </option>
                  {existingLenders.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.displayName}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs text-slate-500" htmlFor="newDisplayName">
                      Name
                    </label>
                    <input
                      id="newDisplayName"
                      name="newDisplayName"
                      type="text"
                      required
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500" htmlFor="newPartyType">
                      Type
                    </label>
                    <select
                      id="newPartyType"
                      name="newPartyType"
                      defaultValue="BUSINESS"
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="BUSINESS">Business</option>
                      <option value="INDIVIDUAL">Individual</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-4 gap-3">
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
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500" htmlFor="ownershipPercent">
                  Ownership (%)
                </label>
                <input
                  id="ownershipPercent"
                  name="ownershipPercent"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="100"
                  required
                  defaultValue="100"
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
                  defaultValue={today}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-500" htmlFor="servicingFee">
                Servicing Fee ($)
              </label>
              <input
                id="servicingFee"
                name="servicingFee"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="w-full max-w-[10rem] rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-400">
                Flat dollar amount deducted from this lender&apos;s share of each payment. Leave blank for none.
              </p>
            </div>

            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          </div>

          <div className="flex items-center justify-end border-t border-slate-200 px-5 py-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {pending ? "Saving..." : "Save Funding"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
