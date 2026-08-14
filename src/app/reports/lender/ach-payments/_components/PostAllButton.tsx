"use client";

import { useState } from "react";

export default function PostAllButton({ onPost }: { onPost: () => Promise<{ success?: string; error?: string }> }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ success?: string; error?: string } | null>(null);

  async function handleClick() {
    setPending(true);
    setResult(null);
    setResult(await onPost());
    setPending(false);
  }

  return (
    <div className="flex items-center gap-2 print:hidden">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Posting…" : "Post to Lender Portal"}
      </button>
      {result?.success && <span className="text-sm text-emerald-700">{result.success}</span>}
      {result?.error && <span className="text-sm text-red-600">{result.error}</span>}
    </div>
  );
}
