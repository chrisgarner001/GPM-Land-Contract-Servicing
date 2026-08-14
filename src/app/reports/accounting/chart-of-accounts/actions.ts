"use server";

import { db } from "@/db/client";
import { glCodes } from "@/db/schema/setup";
import { GL_CODE_TYPE_LABELS } from "@/app/setup/gl-codes/glCodeTypeLabels";
import { sendEmail } from "@/lib/resend";

export async function emailChartOfAccountsAction(recipientEmail: string): Promise<{ success?: string; error?: string }> {
  try {
    const rows = await db.select().from(glCodes).orderBy(glCodes.code);
    const body = rows
      .map((g) => `<tr><td>${g.code}</td><td>${g.description ?? "—"}</td><td>${g.type ? GL_CODE_TYPE_LABELS[g.type] : "—"}</td></tr>`)
      .join("");
    const html = `<h2>Chart of Accounts</h2><table cellpadding="4" style="border-collapse:collapse;width:100%"><thead><tr><th>Code</th><th>Description</th><th>Type</th></tr></thead><tbody>${body}</tbody></table>`;
    await sendEmail({ to: recipientEmail, subject: "Chart of Accounts", html });
    return { success: "Sent." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send." };
  }
}
