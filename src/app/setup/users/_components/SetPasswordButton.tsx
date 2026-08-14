"use client";

import { useState } from "react";
import { setStaffPasswordAction } from "../actions";

export default function SetPasswordButton({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setState("saving");
    setError(null);
    const result = await setStaffPasswordAction(email, password);
    if (result.error) {
      setError(result.error);
      setState("error");
      return;
    }
    setState("saved");
    setPassword("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-500/20 hover:bg-slate-200"
      >
        {state === "saved" ? "Password Set — Set Again" : "Set Password"}
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password (min 8 chars)"
        className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={state === "saving" || password.length < 8}
        className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === "saving" ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setPassword("");
          setError(null);
        }}
        className="text-xs font-medium text-slate-500 hover:underline"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
