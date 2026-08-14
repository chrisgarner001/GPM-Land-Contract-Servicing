"use server";

import { getServicingBalanceSheet, renderServicingBalanceSheetHtml } from "@/server/accountingReports";
import { sendEmail } from "@/lib/resend";
import { createClient } from "@/lib/supabase/server";
import { requireEditAccess } from "@/lib/staffRole";

export async function emailBalanceSheetAction(asOfDate: string, recipientEmail: string): Promise<{ success?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await requireEditAccess(user?.email);

    const data = await getServicingBalanceSheet(asOfDate);
    const html = renderServicingBalanceSheetHtml(data);
    await sendEmail({ to: recipientEmail, subject: "Servicing Balance Sheet", html });
    return { success: "Sent." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send." };
  }
}
