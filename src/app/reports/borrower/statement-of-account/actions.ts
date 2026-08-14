"use server";

import { createClient } from "@/lib/supabase/server";
import { getStatementOfAccountData, renderStatementOfAccountHtml } from "@/server/borrowerReports";
import { sendEmail } from "@/lib/resend";
import { db } from "@/db/client";
import { postedBorrowerDocuments } from "@/db/schema/postedBorrowerDocuments";

export async function emailStatementAction(
  contractId: string,
  startDate: string,
  endDate: string,
  recipientEmail: string
): Promise<{ success?: string; error?: string }> {
  try {
    const data = await getStatementOfAccountData(contractId, startDate, endDate);
    const html = renderStatementOfAccountHtml(data, startDate, endDate);
    await sendEmail({ to: recipientEmail, subject: `Statement of Account — ${data.contractNumber}`, html });
    return { success: "Sent." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send." };
  }
}

export async function postStatementAction(
  contractId: string,
  startDate: string,
  endDate: string
): Promise<{ success?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const data = await getStatementOfAccountData(contractId, startDate, endDate);
    const html = renderStatementOfAccountHtml(data, startDate, endDate);
    await db.insert(postedBorrowerDocuments).values({
      contractId,
      documentType: "STATEMENT_OF_ACCOUNT",
      rangeStart: startDate,
      rangeEnd: endDate,
      contentHtml: html,
      postedBy: user?.email ?? null,
    });
    return { success: "Posted to borrower portal." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to post." };
  }
}
