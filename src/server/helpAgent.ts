import Anthropic from "@anthropic-ai/sdk";
import { HELP_DOCS_CONTENT } from "./helpDocsContent.generated";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const HELP_SYSTEM_PROMPT = `You are the in-app Help Assistant for SGMS staff using "Land Contract Servicing," an internal loan-servicing application. You answer staff questions about how to use the app — where a feature lives, what a screen does, how a workflow works — based ONLY on the documentation below.

Rules:
- Answer using only the documentation provided. If it doesn't cover something, say you're not sure rather than guessing at how the app behaves.
- Be concise and practical — staff want a quick answer, not an essay. Point to the specific page/URL (e.g. "/lenders/print-checks") when relevant.
- These docs describe internal architecture (schema tables, business rules) — it's fine to reference that level of detail since the audience is internal staff, not customers.
- This is a chat, not a report — no markdown headers, keep formatting light.

--- PRODUCT DOCUMENTATION ---

${HELP_DOCS_CONTENT}`;

const client = new Anthropic();

export async function askHelpAgent(history: ChatMessage[], userMessage: string): Promise<string> {
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    // The docs bundle is ~38k tokens and identical on every call — caching it
    // means only the first turn of a conversation pays full input cost.
    system: [{ type: "text", text: HELP_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [...history.map((h) => ({ role: h.role, content: h.content })), { role: "user" as const, content: userMessage }],
  });
  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) throw new Error("No response from the assistant.");
  return textBlock.text;
}
