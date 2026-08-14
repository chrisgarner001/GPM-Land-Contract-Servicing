"use client";

import { useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { askHelpAgentAction } from "./helpActions";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Mounted once in the root layout (alongside Sidebar, same showStaffChrome
// gate) so it floats over every staff page rather than being its own route —
// conversation state lives here and survives client-side navigation since
// the root layout doesn't remount between pages.
export default function HelpWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!input.trim()) return;
    const userMessage = input.trim();
    setInput("");
    setSending(true);
    setError(null);
    const nextMessages = [...messages, { role: "user" as const, content: userMessage }];
    setMessages(nextMessages);
    try {
      const reply = await askHelpAgentAction(messages, userMessage);
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 flex w-96 flex-col rounded-lg border border-slate-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-neutral-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Help</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-neutral-800"
              aria-label="Close help"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ minHeight: 320, maxHeight: 420 }}>
            {messages.length === 0 && (
              <p className="text-sm text-slate-400">
                Ask about any feature — e.g. &ldquo;how do I print lender checks?&rdquo; or &ldquo;what does Charge
                Lender mode do on a vendor invoice?&rdquo;
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-6 bg-blue-50 text-blue-900"
                    : "mr-6 bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-200"
                }`}
              >
                {m.content}
              </div>
            ))}
            {sending && <div className="mr-6 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-400 dark:bg-neutral-800">Thinking…</div>}
          </div>

          {error && <p className="px-4 pb-2 text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 border-t border-slate-100 p-3 dark:border-neutral-800">
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
              placeholder="Ask a question about the app…"
              disabled={sending}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {sending ? "…" : "Send"}
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg hover:bg-slate-800"
        aria-label={open ? "Close help" : "Open help"}
      >
        {open ? <X size={20} /> : <HelpCircle size={20} />}
      </button>
    </div>
  );
}
