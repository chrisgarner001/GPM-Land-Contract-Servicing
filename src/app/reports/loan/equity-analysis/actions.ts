"use server";

import { createClient } from "@/lib/supabase/server";
import { getEquityAnalysis, renderEquityAnalysisHtml } from "@/server/loanReports";
import { sendEmail } from "@/lib/resend";
import { requireEditAccess } from "@/lib/staffRole";

export async function emailEquityAnalysisAction(
  qualifyingOnly: boolean,
  thresholdPercent: number,
  recipientEmail: string
): Promise<{ success?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await requireEditAccess(user?.email);

    const allRows = await getEquityAnalysis(thresholdPercent);
    const rows = qualifyingOnly ? allRows.filter((r) => r.qualifies) : allRows;
    const html = renderEquityAnalysisHtml(rows, thresholdPercent);
    await sendEmail({ to: recipientEmail, subject: "Land Contract Equity Analysis", html });
    return { success: "Sent." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send." };
  }
}
