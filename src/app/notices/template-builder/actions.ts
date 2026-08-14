"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  draftNoticeContent,
  saveNoticeTemplate,
  type ChatMessage,
  type NoticeCategory,
  type NoticeChannel,
  type NoticeDraft,
} from "@/server/notices";

export interface DraftNoticeResult {
  assistantReply: string;
  draft: NoticeDraft;
}

export async function draftNoticeAction(
  category: NoticeCategory,
  channel: NoticeChannel,
  history: ChatMessage[],
  currentDraft: NoticeDraft | null,
  userMessage: string
): Promise<DraftNoticeResult> {
  if (!userMessage.trim()) throw new Error("Enter a message.");
  return draftNoticeContent(category, channel, history, currentDraft, userMessage.trim());
}

export async function saveNoticeTemplateAction(
  category: NoticeCategory,
  channel: NoticeChannel,
  name: string,
  draft: NoticeDraft,
  minDaysPastDue: number | null
): Promise<{ id: string }> {
  if (!name.trim()) throw new Error("Enter a name for this template.");
  if (!draft.body.trim()) throw new Error("Nothing to save yet — draft a notice first.");
  if (channel === "EMAIL" && !draft.subject?.trim()) throw new Error("This email notice needs a subject line.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await saveNoticeTemplate({
    category,
    channel,
    name: name.trim(),
    subject: channel === "EMAIL" ? (draft.subject?.trim() ?? null) : null,
    bodyTemplate: draft.body,
    minDaysPastDue: category === "BORROWER" ? minDaysPastDue : null,
    createdBy: user?.email ?? null,
  });

  revalidatePath(`/notices/${category.toLowerCase()}`);
  return result;
}
