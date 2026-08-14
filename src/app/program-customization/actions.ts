"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSuperUser } from "@/lib/superUser";
import {
  continueConversation,
  generateBriefs,
  saveCustomizationRequest,
  type ChatMessage,
  type GeneratedBriefs,
  type TaskType,
} from "@/server/customizationRequests";

async function requireSuperUser(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!(await isSuperUser(user?.email))) throw new Error("Not authorized.");
  return user?.email ?? null;
}

export async function continueConversationAction(history: ChatMessage[], userMessage: string): Promise<string> {
  await requireSuperUser();
  if (!userMessage.trim()) throw new Error("Enter a message.");
  return continueConversation(history, userMessage.trim());
}

export async function generateBriefsAction(conversation: ChatMessage[]): Promise<GeneratedBriefs> {
  await requireSuperUser();
  if (conversation.length === 0) throw new Error("Describe the customization first.");
  return generateBriefs(conversation);
}

export async function saveCustomizationRequestAction(input: {
  id?: string;
  title: string;
  taskType: TaskType;
  status: "DRAFTING" | "SUBMITTED";
  conversation: ChatMessage[];
  productBriefMarkdown: string;
  engineeringBriefMarkdown: string;
}): Promise<{ id: string }> {
  const email = await requireSuperUser();
  const result = await saveCustomizationRequest({ ...input, requestedBy: email });
  revalidatePath("/program-customization");
  return result;
}
