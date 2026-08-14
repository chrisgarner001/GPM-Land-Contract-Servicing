"use server";

import { getLender1099Data, renderLender1099Html } from "@/server/taxForms";
import { sendEmail } from "@/lib/resend";
import { createClient } from "@/lib/supabase/server";
import { requireEditAccess } from "@/lib/staffRole";

export async function emailLender1099Action(taxYear: number, recipientEmail: string): Promise<{ success?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await requireEditAccess(user?.email);

    const rows = await getLender1099Data(taxYear);
    const html = renderLender1099Html(rows, taxYear);
    await sendEmail({ to: recipientEmail, subject: `1099-INT Worksheet — Tax Year ${taxYear}`, html });
    return { success: "Sent." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send." };
  }
}
