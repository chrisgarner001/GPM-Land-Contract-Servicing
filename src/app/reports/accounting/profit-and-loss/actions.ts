"use server";

import { getServicingIncomeStatement, renderServicingIncomeStatementHtml } from "@/server/accountingReports";
import { sendEmail } from "@/lib/resend";
import { createClient } from "@/lib/supabase/server";
import { requireEditAccess } from "@/lib/staffRole";

export async function emailProfitAndLossAction(
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

    const data = await getServicingIncomeStatement(startDate, endDate);
    const html = renderServicingIncomeStatementHtml(data, startDate, endDate);
    await sendEmail({ to: recipientEmail, subject: "Servicing Income Statement", html });
    return { success: "Sent." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send." };
  }
}
