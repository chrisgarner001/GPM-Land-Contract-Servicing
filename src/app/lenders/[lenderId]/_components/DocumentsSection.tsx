"use client";

import { useActionState } from "react";
import { updateLenderDriveFolder, type UpdateDriveFolderState } from "../actions";

export default function DocumentsSection({
  lenderId,
  googleDriveFolderUrl,
}: {
  lenderId: string;
  googleDriveFolderUrl: string | null;
}) {
  const action = updateLenderDriveFolder.bind(null, lenderId);
  const [state, formAction, pending] = useActionState<UpdateDriveFolderState | undefined, FormData>(action, undefined);

  return (
    <div className="rounded-lg border border-slate-200 shadow-sm p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Documents</h3>

      {googleDriveFolderUrl ? (
        <a
          href={googleDriveFolderUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline"
        >
          Open Documents in Google Drive ↗
        </a>
      ) : (
        <p className="mb-3 text-sm text-slate-400">No Google Drive folder linked yet.</p>
      )}

      <form action={formAction} className="flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-slate-500" htmlFor="googleDriveFolderUrl">
            Google Drive &quot;Client&quot; Folder Link
          </label>
          <input
            id="googleDriveFolderUrl"
            name="googleDriveFolderUrl"
            type="url"
            defaultValue={googleDriveFolderUrl ?? ""}
            placeholder="https://drive.google.com/drive/folders/..."
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save"}
        </button>
      </form>
      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="mt-2 text-sm text-emerald-700">{state.success}</p>}
    </div>
  );
}
