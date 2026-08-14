"use server";

import { createClient } from "@/lib/supabase/server";
import { getOutstandingChargesData, renderOutstandingChargesHtml } from "@/server/borrowerReports";
import { sendEmail } from "@/lib/resend";
import { db } from "@/db/client";
import { postedBorrowerDocuments } from "@/db/schema/postedBorrowerDocuments";
import { requireEditAccess } from "@/lib/staffRole";

export async function emailChargesAction(
  contractId: string,
  startDate: string,
  endDate: string,
  recipientEmail: string
): Promise<{ success?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await requireEditAccess(user?.email);

    const data = await getOutstandingChargesData(contractId, startDate, endDate);
    const html = renderOutstandingChargesHtml(data, startDate, endDate);
    await sendEmail({ to: recipientEmail, subject: `Outstanding Charges — ${data.contractNumber}`, html });
    return { success: "Sent." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send." };
  }
}

export async function postChargesAction(
  contractId: string,
  startDate: string,
  endDate: string
): Promise<{ success?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await requireEditAccess(user?.email);

    const data = await getOutstandingChargesData(contractId, startDate, endDate);
    const html = renderOutstandingChargesHtml(data, startDate, endDate);
    await db.insert(postedBorrowerDocuments).values({
      contractId,
      documentType: "OUTSTANDING_CHARGES",
      rangeStart: startDate,
      rangeEnd: endDate,
      contentHtml: html,
      postedBy: user?.email ?? null,
    });
    return { success: "Posted to borrower portal." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to post." };
  }
}
