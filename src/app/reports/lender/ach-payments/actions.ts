"use server";

import { createClient } from "@/lib/supabase/server";
import { getAchPaymentsData, getLenderOptions, renderAchPaymentsHtml } from "@/server/lenderReports";
import { db } from "@/db/client";
import { postedLenderDocuments } from "@/db/schema/postedLenderDocuments";
import { requireEditAccess } from "@/lib/staffRole";

// Universal — posts every currently-listed (i.e. has ACH payments in this
// range) lender's document in one action, rather than staff clicking Post
// once per lender. Re-fetches each lender's data server-side rather than
// trusting the client's list, same reasoning as everywhere else money-
// adjacent in this app re-derives rather than trusts client state.
export async function postAllAchPaymentsAction(
  lenderIds: string[],
  startDate: string,
  endDate: string
): Promise<{ success?: string; error?: string }> {
  if (lenderIds.length === 0) return { error: "No lenders to post." };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await requireEditAccess(user?.email);

    const [options, allData] = await Promise.all([getLenderOptions(), getAchPaymentsData(lenderIds, startDate, endDate)]);
    const namesById = new Map(options.map((l) => [l.id, l.displayName]));
    const dataById = new Map(allData.map((d) => [d.lenderId, d]));

    let posted = 0;
    for (const lenderId of lenderIds) {
      const data = dataById.get(lenderId);
      if (!data || data.checks.length === 0) continue;
      const lenderName = namesById.get(lenderId) ?? "Unknown Lender";
      const html = renderAchPaymentsHtml(lenderName, data, startDate, endDate);
      await db.insert(postedLenderDocuments).values({
        lenderPartyId: lenderId,
        documentType: "ACH_PAYMENTS",
        rangeStart: startDate,
        rangeEnd: endDate,
        contentHtml: html,
        postedBy: user?.email ?? null,
      });
      posted++;
    }

    if (posted === 0) return { error: "Nothing to post — no lenders with ACH payments in this range." };
    return { success: `Posted to ${posted} lender portal${posted === 1 ? "" : "s"}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to post." };
  }
}
