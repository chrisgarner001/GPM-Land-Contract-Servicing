"use server";

import { createClient } from "@/lib/supabase/server";
import { getPrincipalChangeData, getLenderOptions, renderPrincipalChangeHtml } from "@/server/lenderReports";
import { sendEmail } from "@/lib/resend";
import { db } from "@/db/client";
import { postedLenderDocuments } from "@/db/schema/postedLenderDocuments";

async function getLenderName(lenderId: string): Promise<string> {
  const options = await getLenderOptions();
  return options.find((l) => l.id === lenderId)?.displayName ?? "Unknown Lender";
}

export async function emailPrincipalChangeAction(
  lenderId: string,
  startDate: string,
  endDate: string,
  recipientEmail: string
): Promise<{ success?: string; error?: string }> {
  try {
    const [data] = await getPrincipalChangeData([lenderId], startDate, endDate);
    const lenderName = await getLenderName(lenderId);
    const html = renderPrincipalChangeHtml(lenderName, data, startDate, endDate);
    await sendEmail({ to: recipientEmail, subject: `Portfolio Change in Principal — ${lenderName}`, html });
    return { success: "Sent." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send." };
  }
}

export async function postPrincipalChangeAction(
  lenderId: string,
  startDate: string,
  endDate: string
): Promise<{ success?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const [data] = await getPrincipalChangeData([lenderId], startDate, endDate);
    const lenderName = await getLenderName(lenderId);
    const html = renderPrincipalChangeHtml(lenderName, data, startDate, endDate);
    await db.insert(postedLenderDocuments).values({
      lenderPartyId: lenderId,
      documentType: "PRINCIPAL_CHANGE",
      rangeStart: startDate,
      rangeEnd: endDate,
      contentHtml: html,
      postedBy: user?.email ?? null,
    });
    return { success: "Posted to lender portal." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to post." };
  }
}
