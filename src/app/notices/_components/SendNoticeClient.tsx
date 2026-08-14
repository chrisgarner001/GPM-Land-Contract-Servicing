"use client";

import { useState } from "react";
import { previewNoticeAction, sendNoticeEmailAction } from "../_actions";
import type { NoticeCategory } from "@/server/notices";

export interface RecipientOption {
  id: string;
  displayName: string;
  email: string | null;
  contractId?: string;
  daysPastDue?: number;
}

export default function SendNoticeClient({
  templateId,
  category,
  channel,
  recipients,
  minDaysPastDue,
}: {
  templateId: string;
  category: NoticeCategory;
  channel: "EMAIL" | "LETTER";
  recipients: RecipientOption[];
  minDaysPastDue?: number | null;
}) {
  const isBulkThreshold = channel === "EMAIL" && minDaysPastDue != null;

  if (isBulkThreshold) {
    return (
      <BulkThresholdSend
        templateId={templateId}
        category={category}
        recipients={recipients}
        minDaysPastDue={minDaysPastDue}
      />
    );
  }

  return <SingleRecipientSend templateId={templateId} category={category} channel={channel} recipients={recipients} />;
}

function SingleRecipientSend({
  templateId,
  category,
  channel,
  recipients,
}: {
  templateId: string;
  category: NoticeCategory;
  channel: "EMAIL" | "LETTER";
  recipients: RecipientOption[];
}) {
  const [recipientId, setRecipientId] = useState("");
  const [preview, setPreview] = useState<{ subject: string | null; body: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendResult, setSendResult] = useState<{ status: "SENT" | "FAILED"; errorMessage?: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recipient = recipients.find((r) => r.id === recipientId) ?? null;

  async function handlePick(id: string) {
    setRecipientId(id);
    setPreview(null);
    setSendResult(null);
    setError(null);
    if (!id) return;
    setLoading(true);
    try {
      const result = await previewNoticeAction(templateId, id);
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to render the preview.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!recipient || !preview) return;
    if (!recipient.email) return;
    setSending(true);
    setError(null);
    try {
      const result = await sendNoticeEmailAction(
        templateId,
        category,
        recipient.id,
        recipient.contractId ?? null,
        recipient.email,
        preview.subject ?? "",
        preview.body
      );
      setSendResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <label className="mb-1 block text-xs text-slate-500" htmlFor="recipient">
          Recipient
        </label>
        <select
          id="recipient"
          value={recipientId}
          onChange={(e) => handlePick(e.target.value)}
          className="w-full max-w-md rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">Select…</option>
          {recipients.map((r) => (
            <option key={r.id} value={r.id}>
              {r.displayName}
            </option>
          ))}
        </select>
        {recipient && channel === "EMAIL" && !recipient.email && (
          <p className="mt-2 text-sm text-amber-600">No email on file for this recipient — Letter only, or add an email first.</p>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {loading && <p className="text-sm text-slate-400">Rendering preview…</p>}

      {preview && channel === "EMAIL" && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm">
            <span className="font-semibold text-slate-500">To: </span>
            {recipient?.email ?? "—"}
          </p>
          <p className="mb-3 text-sm">
            <span className="font-semibold text-slate-500">Subject: </span>
            {preview.subject}
          </p>
          <p className="whitespace-pre-wrap border-t border-slate-100 pt-3 text-sm text-slate-800">{preview.body}</p>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !recipient?.email || sendResult?.status === "SENT"}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {sending ? "Sending…" : sendResult?.status === "SENT" ? "Sent" : "Send Email"}
            </button>
            {sendResult?.status === "SENT" && <span className="text-sm text-emerald-700">Sent successfully.</span>}
            {sendResult?.status === "FAILED" && <span className="text-sm text-red-600">Failed: {sendResult.errorMessage}</span>}
          </div>
        </div>
      )}

      {preview && channel === "LETTER" && (
        <div>
          <div className="mb-3 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Print
            </button>
          </div>
          <div className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-10 shadow-sm print:border-0 print:shadow-none">
            <p className="whitespace-pre-wrap text-sm text-slate-800">{preview.body}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Late Notice templates with a day-threshold: instead of picking one
// recipient at a time, show every borrower who's currently at or past the
// threshold, pre-checked, and send to all of them in one action — still one
// real email per recipient via the same per-recipient send action, just
// looped, so nothing about the delivery mechanism changes.
function BulkThresholdSend({
  templateId,
  category,
  recipients,
  minDaysPastDue,
}: {
  templateId: string;
  category: NoticeCategory;
  recipients: RecipientOption[];
  minDaysPastDue: number;
}) {
  const eligible = recipients.filter((r) => (r.daysPastDue ?? 0) >= minDaysPastDue);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(eligible.map((r) => r.id)));
  const [statuses, setStatuses] = useState<Record<string, "SENDING" | "SENT" | "FAILED">>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSelected = eligible.length > 0 && selectedIds.size === eligible.length;

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(eligible.map((r) => r.id)));
  }

  async function handleSend() {
    setSending(true);
    setError(null);
    const targets = eligible.filter((r) => selectedIds.has(r.id) && r.email);
    for (const r of targets) {
      setStatuses((prev) => ({ ...prev, [r.id]: "SENDING" }));
      try {
        const preview = await previewNoticeAction(templateId, r.id);
        const result = await sendNoticeEmailAction(
          templateId,
          category,
          r.id,
          r.contractId ?? null,
          r.email!,
          preview.subject ?? "",
          preview.body
        );
        setStatuses((prev) => ({ ...prev, [r.id]: result.status }));
      } catch {
        setStatuses((prev) => ({ ...prev, [r.id]: "FAILED" }));
      }
    }
    setSending(false);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">
            {eligible.length} borrower{eligible.length === 1 ? "" : "s"} at or past {minDaysPastDue} days past due
          </p>
          <button type="button" onClick={toggleSelectAll} className="text-sm text-blue-700 hover:underline">
            {allSelected ? "Deselect All" : "Select All"}
          </button>
        </div>

        {eligible.length === 0 ? (
          <p className="text-sm text-slate-400">No borrowers currently meet this threshold.</p>
        ) : (
          <ul className="max-h-96 space-y-1 overflow-y-auto">
            {eligible.map((r) => {
              const status = statuses[r.id];
              return (
                <li key={r.id} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-slate-50">
                  <label className="flex flex-1 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggle(r.id)}
                      disabled={sending}
                    />
                    <span className="text-slate-800">{r.displayName}</span>
                    <span className="text-xs text-slate-400">{r.daysPastDue} days past due</span>
                    {!r.email && <span className="text-xs text-amber-600">no email on file</span>}
                  </label>
                  {status && (
                    <span
                      className={`text-xs font-medium ${
                        status === "SENT"
                          ? "text-emerald-700"
                          : status === "FAILED"
                          ? "text-red-600"
                          : "text-slate-400"
                      }`}
                    >
                      {status === "SENDING" ? "Sending…" : status === "SENT" ? "Sent" : "Failed"}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4">
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || selectedIds.size === 0}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? "Sending…" : `Send to ${selectedIds.size} Selected`}
          </button>
        </div>
      </div>
    </div>
  );
}
