"use client";

import { useActionState } from "react";
import { overridePaymentReleaseAction, type OverrideReleaseState } from "../actions";

export default function OverrideReleaseButton({ paymentId }: { paymentId: string }) {
  const action = overridePaymentReleaseAction.bind(null, paymentId);
  const [state, formAction, pending] = useActionState<OverrideReleaseState | undefined, FormData>(action, undefined);

  if (state?.success) {
    return <span className="text-xs text-emerald-700">Included</span>;
  }

  return (
    <form action={formAction} className="inline">
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
      >
        {pending ? "Including..." : "Include Anyway"}
      </button>
      {state?.error && <span className="ml-2 text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
