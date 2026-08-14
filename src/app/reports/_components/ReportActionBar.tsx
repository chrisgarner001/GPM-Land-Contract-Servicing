"use client";

import { useState } from "react";

export interface ReportActionBarProps {
  // Omit onPost entirely for reports that must never be postable to a
  // single borrower's/lender's portal (e.g. a bulk directory of everyone).
  onPost?: () => Promise<{ success?: string; error?: string }>;
  // Lender reports must pass "Post to Lender Portal" — defaults to Borrower
  // since most callers are borrower reports.
  postLabel?: string;
  onEmail: (recipientEmail: string) => Promise<{ success?: string; error?: string }>;
  defaultRecipientEmail?: string;
  excelHref: string;
}

export default function ReportActionBar({ onPost, postLabel = "Post to Borrower Portal", onEmail, defaultRecipientEmail, excelHref }: ReportActionBarProps) {
  const [showEmail, setShowEmail] = useState(false);
  const [recipient, setRecipient] = useState(defaultRecipientEmail ?? "");
  const [emailPending, setEmailPending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ success?: string; error?: string } | null>(null);
  const [postPending, setPostPending] = useState(false);
  const [postResult, setPostResult] = useState<{ success?: string; error?: string } | null>(null);

  async function handleSendEmail() {
    if (!recipient.trim()) return;
    setEmailPending(true);
    setEmailResult(null);
    const result = await onEmail(recipient.trim());
    setEmailPending(false);
    setEmailResult(result);
  }

  async function handlePost() {
    setPostPending(true);
    setPostResult(null);
    const result = await onPost!();
    setPostPending(false);
    setPostResult(result);
  }

  return (
    <div className="mb-4 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Print
        </button>
        <button
          type="button"
          onClick={() => setShowEmail((v) => !v)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Email
        </button>
        <a
          href={excelHref}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Download Excel
        </a>
        {onPost && (
          <button
            type="button"
            onClick={handlePost}
            disabled={postPending}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {postPending ? "Posting…" : postLabel}
          </button>
        )}
        {postResult?.success && <span className="text-sm text-emerald-700">{postResult.success}</span>}
        {postResult?.error && <span className="text-sm text-red-600">{postResult.error}</span>}
      </div>

      {showEmail && (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
          <input
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="recipient@example.com"
            className="w-64 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={handleSendEmail}
            disabled={emailPending || !recipient.trim()}
            className="rounded-md bg-slate-900 px-3 py-1 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {emailPending ? "Sending…" : "Send"}
          </button>
          {emailResult?.success && <span className="text-sm text-emerald-700">{emailResult.success}</span>}
          {emailResult?.error && <span className="text-sm text-red-600">{emailResult.error}</span>}
        </div>
      )}
    </div>
  );
}
