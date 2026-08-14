"use client";

import { useActionState } from "react";
import { composeEmail, type ComposeEmailState } from "@/server/partyEmailDrafts";
import { formatDateTime } from "@/lib/format";

interface OutgoingEmail {
  id: string;
  toAddress: string;
  ccAddress: string | null;
  bccAddress: string | null;
  subject: string;
  status: string;
  createdAt: Date;
}

// Shared by the Borrower and Lender detail pages — both are `parties` rows
// backed by the same party_email_drafts queue.
export default function ComposeEmailForm({
  partyId,
  revalidateBasePath,
  defaultToAddress,
  pendingEmails,
}: {
  partyId: string;
  revalidateBasePath: string;
  defaultToAddress: string | null;
  pendingEmails: OutgoingEmail[];
}) {
  const action = composeEmail.bind(null, partyId, revalidateBasePath);
  const [state, formAction, pending] = useActionState<ComposeEmailState | undefined, FormData>(action, undefined);

  return (
    <div>
      <form action={formAction} className="space-y-2">
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="toAddress">
            To
          </label>
          <input
            id="toAddress"
            name="toAddress"
            type="email"
            required
            defaultValue={defaultToAddress ?? ""}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="ccAddress">
            CC
          </label>
          <input
            id="ccAddress"
            name="ccAddress"
            type="text"
            placeholder="Optional — separate multiple addresses with commas"
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="bccAddress">
            BCC
          </label>
          <input
            id="bccAddress"
            name="bccAddress"
            type="text"
            placeholder="Optional — separate multiple addresses with commas"
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="subject">
            Subject
          </label>
          <input
            id="subject"
            name="subject"
            type="text"
            required
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="emailBody">
            Message
          </label>
          <textarea
            id="emailBody"
            name="body"
            rows={4}
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <p className="text-xs text-slate-400">
          Sent via info@successgroupmortgage.com — an admin creates a Gmail draft from this for review before it
          actually goes out.
        </p>
        <div className="flex items-center justify-between">
          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          {state?.success && <p className="text-sm text-emerald-700">{state.success}</p>}
          <button
            type="submit"
            disabled={pending}
            className="ml-auto rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? "Queuing..." : "Send"}
          </button>
        </div>
      </form>

      {pendingEmails.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Queued / Drafted</p>
          <ul className="space-y-1">
            {pendingEmails.map((e) => (
              <li key={e.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  {e.subject}{" "}
                  <span className="text-slate-400">
                    → {e.toAddress}
                    {e.ccAddress && ` (cc: ${e.ccAddress})`}
                    {e.bccAddress && ` (bcc: ${e.bccAddress})`}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-xs text-slate-400">
                  {formatDateTime(e.createdAt)}
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${
                      e.status === "DRAFTED" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {e.status === "DRAFTED" ? "Draft ready in Gmail" : "Pending"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
