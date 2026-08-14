"use client";

import { useActionState } from "react";
import { deleteContractDraftAction, type DeleteContractDraftState } from "../actions";

export default function DeleteDraftButton({ draftId }: { draftId: string }) {
  const action = deleteContractDraftAction.bind(null, draftId);
  const [state, formAction, pending] = useActionState<DeleteContractDraftState | undefined, FormData>(action, undefined);

  return (
    <form action={formAction} className="inline">
      <button
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (!confirm("Delete this draft? Nothing has been created yet, so this can't be undone.")) {
            e.preventDefault();
          }
        }}
        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
      >
        {pending ? "Deleting..." : "Delete"}
      </button>
      {state?.error && <span className="ml-2 text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
