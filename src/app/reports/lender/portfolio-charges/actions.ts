"use server";

import { createClient } from "@/lib/supabase/server";
import { getPortfolioChargesData, getLenderOptions, renderPortfolioChargesHtml } from "@/server/lenderReports";
import { sendEmail } from "@/lib/resend";
import { db } from "@/db/client";
import { postedLenderDocuments } from "@/db/schema/postedLenderDocuments";
import { requireEditAccess } from "@/lib/staffRole";

async function getLenderName(lenderId: string): Promise<string> {
  const options = await getLenderOptions();
  return options.find((l) => l.id === lenderId)?.displayName ?? "Unknown Lender";
}

export async function emailPortfolioChargesAction(
  lenderId: string,
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

    const [data] = await getPortfolioChargesData([lenderId], startDate, endDate);
    const lenderName = await getLenderName(lenderId);
    const html = renderPortfolioChargesHtml(lenderName, data, startDate, endDate);
    await sendEmail({ to: recipientEmail, subject: `Portfolio Charges — ${lenderName}`, html });
    return { success: "Sent." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send." };
  }
}

export async function postPortfolioChargesAction(
  lenderId: string,
  startDate: string,
  endDate: string
): Promise<{ success?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await requireEditAccess(user?.email);

    const [data] = await getPortfolioChargesData([lenderId], startDate, endDate);
    const lenderName = await getLenderName(lenderId);
    const html = renderPortfolioChargesHtml(lenderName, data, startDate, endDate);
    await db.insert(postedLenderDocuments).values({
      lenderPartyId: lenderId,
      documentType: "PORTFOLIO_CHARGES",
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
