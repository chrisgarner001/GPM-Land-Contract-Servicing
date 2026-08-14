"use server";

import { getListedForSaleProperties, renderListedForSaleHtml } from "@/server/loanReports";
import { sendEmail } from "@/lib/resend";

export async function emailListedForSaleAction(recipientEmail: string): Promise<{ success?: string; error?: string }> {
  try {
    const rows = await getListedForSaleProperties();
    const html = renderListedForSaleHtml(rows);
    await sendEmail({ to: recipientEmail, subject: "Properties Listed For Sale", html });
    return { success: "Sent." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send." };
  }
}
