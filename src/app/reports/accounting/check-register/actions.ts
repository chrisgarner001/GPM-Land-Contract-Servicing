"use server";

import { getCheckRegisterData, renderCheckRegisterHtml } from "@/server/accountingReports";
import { sendEmail } from "@/lib/resend";
import { createClient } from "@/lib/supabase/server";
import { requireEditAccess } from "@/lib/staffRole";

export async function emailCheckRegisterAction(
  bankAccountFilter: string,
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

    const data = await getCheckRegisterData(bankAccountFilter, startDate, endDate);
    const html = renderCheckRegisterHtml(data);
    await sendEmail({ to: recipientEmail, subject: `Check Register — ${data.bankAccountLabel}`, html });
    return { success: "Sent." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send." };
  }
}
