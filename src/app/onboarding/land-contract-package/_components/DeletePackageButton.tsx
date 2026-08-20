"use client";

import { useActionState } from "react";
import { deletePackageAction, type DeletePackageState } from "../actions";

export default function DeletePackageButton({ packageId }: { packageId: string }) {
  const action = deletePackageAction.bind(null, packageId);
  const [state, formAction, pending] = useActionState<DeletePackageState | undefined, FormData>(action, undefined);

  return (
    <form action={formAction} className="inline">
      <button
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (!confirm("Delete this draft package? Nothing has been published yet, so this can't be undone.")) {
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
