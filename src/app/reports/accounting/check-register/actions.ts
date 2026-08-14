"use server";

import { getCheckRegisterData, renderCheckRegisterHtml } from "@/server/accountingReports";
import { sendEmail } from "@/lib/resend";

export async function emailCheckRegisterAction(
  bankAccountFilter: string,
  startDate: string,
  endDate: string,
  recipientEmail: string
): Promise<{ success?: string; error?: string }> {
  try {
    const data = await getCheckRegisterData(bankAccountFilter, startDate, endDate);
    const html = renderCheckRegisterHtml(data);
    await sendEmail({ to: recipientEmail, subject: `Check Register — ${data.bankAccountLabel}`, html });
    return { success: "Sent." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send." };
  }
}
