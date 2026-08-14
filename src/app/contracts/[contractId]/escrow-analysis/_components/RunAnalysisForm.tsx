"use client";

import { useActionState } from "react";
import { runAnalysisAction, type RunAnalysisState } from "../actions";

const TRIGGER_LABELS: Record<string, string> = {
  SEMI_ANNUAL_SCHEDULED: "Semi-Annual Scheduled Review",
  LARGE_BILL_RECEIVED: "Unexpected Large Bill Received",
  ONBOARDING: "Onboarding",
  MANUAL: "Manual",
};

export default function RunAnalysisForm({
  contractId,
  defaultProjectedAnnualTaxDollars,
  defaultProjectedAnnualInsuranceDollars,
  defaultCurrentEscrowBalanceDollars,
  defaultCurrentMonthlyEscrowPaymentDollars,
}: {
  contractId: string;
  defaultProjectedAnnualTaxDollars: string;
  defaultProjectedAnnualInsuranceDollars: string;
  defaultCurrentEscrowBalanceDollars: string;
  defaultCurrentMonthlyEscrowPaymentDollars: string;
}) {
  const action = runAnalysisAction.bind(null, contractId);
  const [state, formAction, pending] = useActionState<RunAnalysisState | undefined, FormData>(action, undefined);

  return (
    <form action={formAction} className="rounded-lg border border-slate-200 shadow-sm p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Run Escrow Analysis</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="trigger">
            Reason
          </label>
          <select
            id="trigger"
            name="trigger"
            defaultValue="SEMI_ANNUAL_SCHEDULED"
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="projectedAnnualTax">
            Projected Annual Tax ($)
          </label>
          <input
            id="projectedAnnualTax"
            name="projectedAnnualTax"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={defaultProjectedAnnualTaxDollars}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="projectedAnnualInsurance">
            Projected Annual Insurance ($)
          </label>
          <input
            id="projectedAnnualInsurance"
            name="projectedAnnualInsurance"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={defaultProjectedAnnualInsuranceDollars}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="currentEscrowBalance">
            Current Escrow Balance ($)
          </label>
          <input
            id="currentEscrowBalance"
            name="currentEscrowBalance"
            type="number"
            step="0.01"
            required
            defaultValue={defaultCurrentEscrowBalanceDollars}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="currentMonthlyEscrowPayment">
            Current Monthly Escrow Payment ($)
          </label>
          <input
            id="currentMonthlyEscrowPayment"
            name="currentMonthlyEscrowPayment"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={defaultCurrentMonthlyEscrowPaymentDollars}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="cushionMonths">
            Cushion (months)
          </label>
          <input
            id="cushionMonths"
            name="cushionMonths"
            type="number"
            step="0.1"
            min="0"
            required
            defaultValue="2"
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="projectionPeriodMonths">
            Projection Period (months)
          </label>
          <input
            id="projectionPeriodMonths"
            name="projectionPeriodMonths"
            type="number"
            step="1"
            min="1"
            required
            defaultValue="12"
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? "Running..." : "Run Analysis"}
          </button>
        </div>
      </div>
      {state?.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="mt-3 text-sm text-emerald-700">{state.success}</p>}
    </form>
  );
}
