"use client";

import { useActionState } from "react";
import { addNote, type AddNoteState } from "../actions";
import { formatDateTime } from "@/lib/format";

interface Note {
  id: string;
  authorEmail: string | null;
  body: string;
  createdAt: Date;
}

export default function NotesSection({ contractId, notes }: { contractId: string; notes: Note[] }) {
  const action = addNote.bind(null, contractId);
  const [state, formAction, pending] = useActionState<AddNoteState | undefined, FormData>(action, undefined);

  return (
    <div className="rounded-lg border border-slate-200 shadow-sm p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</h3>

      <form action={formAction} className="mb-4">
        <textarea
          name="body"
          rows={2}
          required
          placeholder="Add a note about this contract..."
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="ml-auto rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? "Saving..." : "Add Note"}
          </button>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="text-sm text-slate-400">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
              <p className="whitespace-pre-wrap text-sm text-slate-700">{n.body}</p>
              <p className="mt-1 text-xs text-slate-400">
                {n.authorEmail ?? "Unknown"} · {formatDateTime(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
