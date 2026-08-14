"use client";

import { useActionState, useState } from "react";
import { updateEscrowSettingsAction, type UpdateEscrowSettingsState } from "../actions";

export default function EscrowSettingsField({
  contractId,
  escrowRequired,
  monthlyEscrowPaymentCents,
}: {
  contractId: string;
  escrowRequired: boolean;
  monthlyEscrowPaymentCents: number | null;
}) {
  const action = updateEscrowSettingsAction.bind(null, contractId);
  const [state, formAction, pending] = useActionState<UpdateEscrowSettingsState | undefined, FormData>(action, undefined);
  const [checked, setChecked] = useState(escrowRequired);

  return (
    <form action={formAction} className="py-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <label className="flex items-center gap-1.5 text-slate-500">
          <input type="checkbox" name="escrowRequired" value="1" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          Escrow Required
        </label>
        <div className="flex items-center gap-2">
          {checked && (
            <input
              name="monthlyEscrowPayment"
              type="number"
              step="0.01"
              min="0"
              placeholder="Escrow Payment ($)"
              defaultValue={monthlyEscrowPaymentCents !== null ? (monthlyEscrowPaymentCents / 100).toFixed(2) : ""}
              className="w-32 rounded-md border border-slate-300 px-1.5 py-0.5 text-sm font-medium text-slate-900 focus:border-blue-500 focus:outline-none"
            />
          )}
          <button type="submit" disabled={pending} className="text-xs font-medium text-blue-700 hover:underline disabled:opacity-50">
            {pending ? "..." : "Save"}
          </button>
        </div>
      </div>
      {state?.success && <p className="mt-1 text-right text-xs text-emerald-700">{state.success}</p>}
      {state?.error && <p className="mt-1 text-right text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
