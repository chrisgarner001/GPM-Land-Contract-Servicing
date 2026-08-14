"use client";

import { useActionState } from "react";
import { reversePaymentAction, type ReversePaymentState } from "../actions";

export default function ReversePaymentButton({ contractId, paymentId }: { contractId: string; paymentId: string }) {
  const action = reversePaymentAction.bind(null, contractId, paymentId);
  const [state, formAction, pending] = useActionState<ReversePaymentState | undefined, FormData>(action, undefined);

  return (
    <form action={formAction} className="inline">
      <button
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (!confirm("Reverse this payment? This will restore the principal balance and mark it reversed in history.")) {
            e.preventDefault();
          }
        }}
        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
      >
        {pending ? "Reversing..." : "Reverse"}
      </button>
      {state?.error && <span className="ml-2 text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
