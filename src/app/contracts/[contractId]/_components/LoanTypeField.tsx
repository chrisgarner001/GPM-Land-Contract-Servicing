"use client";

import { useActionState } from "react";
import { updateLoanType, type UpdateLoanTypeState } from "../actions";

const LOAN_TYPE_LABELS: Record<string, string> = {
  LAND_CONTRACT: "Land Contract",
  FIRST_LIEN: "1st Lien",
  SECOND_LIEN: "2nd Lien",
  UNSECURED: "Unsecured",
};

export default function LoanTypeField({ contractId, loanType }: { contractId: string; loanType: string }) {
  const action = updateLoanType.bind(null, contractId);
  const [state, formAction, pending] = useActionState<UpdateLoanTypeState | undefined, FormData>(action, undefined);

  return (
    <form action={formAction} className="py-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-slate-500">Loan Type</span>
        <div className="flex items-center gap-2">
          <select
            name="loanType"
            defaultValue={loanType}
            className="rounded-md border border-slate-300 px-1.5 py-0.5 text-sm font-medium text-slate-900 focus:border-blue-500 focus:outline-none"
          >
            {Object.entries(LOAN_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
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
