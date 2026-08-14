"use client";

import { useState, useTransition } from "react";

// Shared by the Borrower and Lender "Log In As" impersonation buttons. Opens
// a new browser window/tab showing exactly what that borrower/lender sees,
// rather than navigating the staff member's own tab away from the admin
// page they were on. The blank window is opened synchronously inside the
// click handler (before the async action runs) so browsers don't treat it
// as an unrequested pop-up — only its destination is set once the action
// resolves.
export default function LogInAsNewWindowButton({
  action,
  portalUrl,
  disabled,
  label = "Log In As",
  className,
}: {
  action: () => Promise<{ error?: string }>;
  portalUrl: string;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const win = window.open("about:blank", "_blank");
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        win?.close();
        return;
      }
      if (win) {
        win.location.href = portalUrl;
      } else {
        setError("Pop-up blocked — allow pop-ups for this site and try again.");
      }
    });
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isPending}
        className={
          className ??
          "inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
        }
      >
        {label}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
