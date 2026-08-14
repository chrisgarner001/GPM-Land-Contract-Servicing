"use server";

import { getServicingBalanceSheet, renderServicingBalanceSheetHtml } from "@/server/accountingReports";
import { sendEmail } from "@/lib/resend";

export async function emailBalanceSheetAction(asOfDate: string, recipientEmail: string): Promise<{ success?: string; error?: string }> {
  try {
    const data = await getServicingBalanceSheet(asOfDate);
    const html = renderServicingBalanceSheetHtml(data);
    await sendEmail({ to: recipientEmail, subject: "Servicing Balance Sheet", html });
    return { success: "Sent." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send." };
  }
}
