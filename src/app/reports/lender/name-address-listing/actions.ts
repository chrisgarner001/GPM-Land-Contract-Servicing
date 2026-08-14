"use server";

import { createClient } from "@/lib/supabase/server";
import { getLenderNameAddressListing, renderLenderNameAddressListingHtml } from "@/server/lenderReports";
import { sendEmail } from "@/lib/resend";
import { requireEditAccess } from "@/lib/staffRole";

export async function emailLenderNameAddressListingAction(recipientEmail: string): Promise<{ success?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await requireEditAccess(user?.email);

    const rows = await getLenderNameAddressListing();
    const html = renderLenderNameAddressListingHtml(rows);
    await sendEmail({ to: recipientEmail, subject: "Lender Name & Address Listing", html });
    return { success: "Sent." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send." };
  }
}
