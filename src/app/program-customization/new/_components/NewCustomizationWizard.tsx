"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { continueConversationAction, generateBriefsAction, saveCustomizationRequestAction } from "../../actions";
import type { TaskType } from "@/server/customizationRequests";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Briefs {
  title: string;
  taskType: TaskType;
  productBriefMarkdown: string;
  engineeringBriefMarkdown: string;
}

type Step = "chat" | "generating" | "review" | "saving";

export default function NewCustomizationWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [briefs, setBriefs] = useState<Briefs | null>(null);
  const [title, setTitle] = useState("");
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
      const reply = await continueConversationAction(messages, userMessage);
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  async function handleGenerate() {
    setStep("generating");
    setError(null);
    try {
      const result = await generateBriefsAction(messages);
      setBriefs(result);
      setTitle(result.title);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to draft the briefs.");
      setStep("chat");
    }
  }

  async function handleSubmit() {
    if (!briefs) return;
    setStep("saving");
    setError(null);
    try {
      const { id } = await saveCustomizationRequestAction({
        title: title.trim() || briefs.title,
        taskType: briefs.taskType,
        status: "SUBMITTED",
        conversation: messages,
        productBriefMarkdown: briefs.productBriefMarkdown,
        engineeringBriefMarkdown: briefs.engineeringBriefMarkdown,
      });
      router.push(`/program-customization/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
      setStep("review");
    }
  }

  if (step === "chat" || step === "generating") {
    return (
      <div className="flex flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ minHeight: 320, maxHeight: 480 }}>
          {messages.length === 0 && (
            <p className="text-sm text-slate-400">
              Describe what you want — e.g. "I want lenders to be able to download a 1099 form from their portal" — the
              agent will ask clarifying questions before drafting anything.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "ml-8 bg-blue-50 text-blue-900" : "mr-8 bg-slate-100 text-slate-700"}`}
            >
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
            placeholder="Describe the customization, or answer a question…"
            disabled={sending || step === "generating"}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || step === "generating" || !input.trim()}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
        <div className="border-t border-slate-100 p-3">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={messages.length === 0 || step === "generating"}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {step === "generating" ? "Drafting Product + Engineering briefs…" : "Generate Briefs"}
          </button>
        </div>
      </div>
    );
  }

  // step === "review" or "saving"
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <label className="mb-1 block text-xs text-slate-500" htmlFor="title">
          Title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={step === "saving"}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Product Brief</h2>
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800">{briefs?.productBriefMarkdown}</pre>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Engineering Brief</h2>
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800">{briefs?.engineeringBriefMarkdown}</pre>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => setStep("chat")}
          disabled={step === "saving"}
          className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          Keep Chatting
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={step === "saving"}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {step === "saving" ? "Saving…" : "Submit for Review"}
        </button>
      </div>
    </div>
  );
}
