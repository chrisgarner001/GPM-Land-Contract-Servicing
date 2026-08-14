"use client";

import { useActionState, useState } from "react";
import { processLenderDistributionAction, type ProcessDistributionState } from "../actions";
import { formatCents } from "@/lib/format";

export default function ProcessDistributionForm({
  lenderPartyId,
  runDate,
  sweepBaselineDate,
  preferredPaymentMethod,
  totalCents,
}: {
  lenderPartyId: string;
  runDate: string;
  sweepBaselineDate: string;
  preferredPaymentMethod: "CHECK" | "ACH" | null;
  totalCents: number;
}) {
  const action = processLenderDistributionAction.bind(null, lenderPartyId);
  const [state, formAction, pending] = useActionState<ProcessDistributionState | undefined, FormData>(action, undefined);
  const [paymentMethod, setPaymentMethod] = useState<"CHECK" | "ACH">(preferredPaymentMethod ?? "CHECK");

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-4">
      <input type="hidden" name="runDate" value={runDate} />
      <input type="hidden" name="sweepBaseline" value={sweepBaselineDate} />

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1 text-sm text-slate-700">
          <input
            type="radio"
            name="paymentMethod"
            value="CHECK"
            checked={paymentMethod === "CHECK"}
            onChange={() => setPaymentMethod("CHECK")}
          />
          Check
        </label>
        <label className="flex items-center gap-1 text-sm text-slate-700">
          <input
            type="radio"
            name="paymentMethod"
            value="ACH"
            checked={paymentMethod === "ACH"}
            onChange={() => setPaymentMethod("ACH")}
          />
          ACH
        </label>
      </div>

      {paymentMethod === "CHECK" && (
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor={`checkNumber-${lenderPartyId}`}>
            Check Number
          </label>
          <input
            id={`checkNumber-${lenderPartyId}`}
            name="checkNumber"
            type="text"
            required
            className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {pending ? "Processing..." : `Process ${formatCents(totalCents)}`}
      </button>

      {state?.success && <p className="text-sm text-emerald-700">{state.success}</p>}
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
