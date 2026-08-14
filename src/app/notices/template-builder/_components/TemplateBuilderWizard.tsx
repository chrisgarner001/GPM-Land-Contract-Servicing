"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { draftNoticeAction, saveNoticeTemplateAction } from "../actions";

type Category = "BORROWER" | "LENDER" | "VENDOR";
type Channel = "EMAIL" | "LETTER";
type Step = "category" | "channel" | "chat" | "saving";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Draft {
  subject: string | null;
  body: string;
}

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "BORROWER", label: "Borrower" },
  { value: "LENDER", label: "Lender" },
  { value: "VENDOR", label: "Vendor" },
];

const CHANNEL_OPTIONS: { value: Channel; label: string; description: string }[] = [
  { value: "EMAIL", label: "Email", description: "Subject line + body, sent directly to a recipient's inbox." },
  { value: "LETTER", label: "Letter", description: "Printable page — no subject line, no send integration." },
];

export default function TemplateBuilderWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("category");
  const [category, setCategory] = useState<Category | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [minDaysPastDue, setMinDaysPastDue] = useState("");

  async function handleSend() {
    if (!category || !channel || !input.trim()) return;
    const userMessage = input.trim();
    setInput("");
    setSending(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    try {
      const result = await draftNoticeAction(category, channel, messages, draft, userMessage);
      setMessages((prev) => [...prev, { role: "assistant", content: result.assistantReply }]);
      setDraft(result.draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong drafting that.");
    } finally {
      setSending(false);
    }
  }

  async function handleApprove() {
    if (!category || !channel || !draft) return;
    setStep("saving");
    setError(null);
    try {
      const parsedMinDaysPastDue = minDaysPastDue.trim() ? Number(minDaysPastDue.trim()) : null;
      const { id } = await saveNoticeTemplateAction(category, channel, templateName, draft, parsedMinDaysPastDue);
      router.push(`/notices/${category.toLowerCase()}?saved=${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save this template.");
      setStep("chat");
    }
  }

  if (step === "category") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Which category is this notice for?</h2>
        <div className="grid grid-cols-3 gap-3">
          {CATEGORY_OPTIONS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => {
                setCategory(c.value);
                setStep("channel");
              }}
              className="rounded-lg border border-slate-200 px-4 py-6 text-center font-medium text-slate-700 hover:border-blue-400 hover:bg-blue-50"
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === "channel") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <button type="button" onClick={() => setStep("category")} className="mb-4 text-sm text-slate-500 hover:underline">
          ← Back
        </button>
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Email or Letter?</h2>
        <div className="grid grid-cols-2 gap-3">
          {CHANNEL_OPTIONS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => {
                setChannel(c.value);
                setStep("chat");
              }}
              className="rounded-lg border border-slate-200 p-4 text-left hover:border-blue-400 hover:bg-blue-50"
            >
              <p className="font-medium text-slate-900">{c.label}</p>
              <p className="mt-1 text-sm text-slate-500">{c.description}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // step === "chat" or "saving"
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="flex flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={() => {
              setStep("channel");
              setChannel(null);
            }}
            className="text-sm text-slate-500 hover:underline"
          >
            ← Back
          </button>
          <p className="mt-1 text-sm font-medium text-slate-700">
            {category} · {channel}
          </p>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ minHeight: 300, maxHeight: 420 }}>
          {messages.length === 0 && (
            <p className="text-sm text-slate-400">
              Describe what this notice should say — e.g. "A friendly reminder that a payment is coming due in 5 days" or "A firm notice for
              an account that's 30+ days past due."
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "ml-8 bg-blue-50 text-blue-900" : "mr-8 bg-slate-100 text-slate-700"}`}>
              {m.content}
            </div>
          ))}
        </div>
        {error && <p className="px-4 text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 border-t border-slate-100 p-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Describe the notice, or ask for a change…"
            disabled={sending || step === "saving"}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || step === "saving" || !input.trim()}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      </div>

      <div className="flex flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-medium text-slate-700">Current Draft</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4" style={{ minHeight: 300, maxHeight: 420 }}>
          {!draft ? (
            <p className="text-sm text-slate-400">Nothing drafted yet — start the conversation on the left.</p>
          ) : (
            <>
              {channel === "EMAIL" && (
                <p className="mb-2 text-sm">
                  <span className="font-semibold text-slate-500">Subject: </span>
                  <span className="text-slate-900">{draft.subject}</span>
                </p>
              )}
              <p className="whitespace-pre-wrap text-sm text-slate-800">{draft.body}</p>
            </>
          )}
        </div>
        {draft && (
          <div className="space-y-2 border-t border-slate-100 p-3">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name (e.g. Payment Reminder)"
              disabled={step === "saving"}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
            {category === "BORROWER" && (
              <div>
                <label className="mb-1 block text-xs text-slate-500" htmlFor="minDaysPastDue">
                  Minimum days past due (optional)
                </label>
                <input
                  id="minDaysPastDue"
                  type="number"
                  min={0}
                  value={minDaysPastDue}
                  onChange={(e) => setMinDaysPastDue(e.target.value)}
                  placeholder="e.g. 60 — leave blank for a single-recipient template"
                  disabled={step === "saving"}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
                />
                <p className="mt-1 text-xs text-slate-400">
                  When set, sending this template shows a checklist of borrowers who are at least this many days past
                  due, instead of a single-recipient picker.
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={handleApprove}
              disabled={step === "saving" || !templateName.trim()}
              className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {step === "saving" ? "Saving…" : "Approve & Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
