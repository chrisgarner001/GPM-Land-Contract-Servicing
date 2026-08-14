"use server";

import { askHelpAgent, type ChatMessage } from "@/server/helpAgent";

export async function askHelpAgentAction(history: ChatMessage[], userMessage: string): Promise<string> {
  if (!userMessage.trim()) throw new Error("Enter a question.");
  return askHelpAgent(history, userMessage.trim());
}
