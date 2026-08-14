"use server";

import { createClient } from "@/lib/supabase/server";
import { getPayoffLetterData, renderPayoffLetterHtml } from "@/server/borrowerReports";
import { sendEmail } from "@/lib/resend";
import { db } from "@/db/client";
import { postedBorrowerDocuments } from "@/db/schema/postedBorrowerDocuments";

export async function emailPayoffLetterAction(
  contractId: string,
  payoffDate: string,
  recipientName: string,
  recipientEmail: string
): Promise<{ success?: string; error?: string }> {
  try {
    const data = await getPayoffLetterData(contractId, payoffDate, recipientName);
    const html = renderPayoffLetterHtml(data);
    await sendEmail({ to: recipientEmail, subject: `Payoff Letter — ${data.contractNumber}`, html });
    return { success: "Sent." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send." };
  }
}

export async function postPayoffLetterAction(
  contractId: string,
  payoffDate: string,
  recipientName: string
): Promise<{ success?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const data = await getPayoffLetterData(contractId, payoffDate, recipientName);
    const html = renderPayoffLetterHtml(data);
    await db.insert(postedBorrowerDocuments).values({
      contractId,
      documentType: "PAYOFF_LETTER",
      rangeStart: payoffDate,
      rangeEnd: payoffDate,
      contentHtml: html,
      postedBy: user?.email ?? null,
    });
    return { success: "Posted to borrower portal." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to post." };
  }
}
