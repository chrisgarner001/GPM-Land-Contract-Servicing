"use client";

import { useState } from "react";
import { sendStaffInviteAction } from "../actions";

export default function InviteButton({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setState("sending");
    setError(null);
    const result = await sendStaffInviteAction(email);
    if (result.error) {
      setError(result.error);
      setState("error");
      return;
    }
    setState("sent");
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={state === "sending" || state === "sent"}
        className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === "sending" ? "Sending…" : state === "sent" ? "Invite Sent" : "Send Invite"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
