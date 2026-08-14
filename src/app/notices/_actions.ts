"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { noticeTemplates } from "@/db/schema/notices";
import { renderNoticeTemplate } from "@/domain/notices/renderNoticeTemplate";
import { getMergeFieldValues, recordNoticeSend, type NoticeCategory } from "@/server/notices";
import { sendNoticeEmail } from "@/lib/resend";

export interface PreviewNoticeResult {
  subject: string | null;
  body: string;
}

export async function previewNoticeAction(templateId: string, recipientId: string): Promise<PreviewNoticeResult> {
  const [template] = await db.select().from(noticeTemplates).where(eq(noticeTemplates.id, templateId));
  if (!template) throw new Error("Template not found.");

  const fields = await getMergeFieldValues(template.category, recipientId);
  return {
    subject: template.subject ? renderNoticeTemplate(template.subject, fields) : null,
    body: renderNoticeTemplate(template.bodyTemplate, fields),
  };
}

export interface SendNoticeEmailResult {
  status: "SENT" | "FAILED";
  errorMessage?: string;
}

export async function sendNoticeEmailAction(
  templateId: string,
  category: NoticeCategory,
  recipientId: string,
  contractId: string | null,
  toEmail: string,
  subject: string,
  body: string
): Promise<SendNoticeEmailResult> {
  try {
    const result = await sendNoticeEmail({ to: toEmail, subject, text: body });
    await recordNoticeSend({
      templateId,
      category,
      recipientId,
      contractId,
      subjectRendered: subject,
      bodyRendered: body,
      status: "SENT",
      providerMessageId: result.id,
      errorMessage: null,
    });
    return { status: "SENT" };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to send.";
    await recordNoticeSend({
      templateId,
      category,
      recipientId,
      contractId,
      subjectRendered: subject,
      bodyRendered: body,
      status: "FAILED",
      providerMessageId: null,
      errorMessage,
    });
    return { status: "FAILED", errorMessage };
  }
}
