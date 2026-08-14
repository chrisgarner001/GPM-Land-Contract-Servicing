"use server";

import { getBorrower1098Data, renderBorrower1098Html } from "@/server/taxForms";
import { sendEmail } from "@/lib/resend";

export async function emailBorrower1098Action(taxYear: number, recipientEmail: string): Promise<{ success?: string; error?: string }> {
  try {
    const rows = await getBorrower1098Data(taxYear);
    const html = renderBorrower1098Html(rows, taxYear);
    await sendEmail({ to: recipientEmail, subject: `1098 Worksheet — Tax Year ${taxYear}`, html });
    return { success: "Sent." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send." };
  }
}
