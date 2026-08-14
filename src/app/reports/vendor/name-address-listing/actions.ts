"use server";

import { createClient } from "@/lib/supabase/server";
import { getVendorNameAddressListing, renderVendorNameAddressListingHtml } from "@/server/vendorReports";
import { sendEmail } from "@/lib/resend";
import { requireEditAccess } from "@/lib/staffRole";

export async function emailVendorNameAddressListingAction(recipientEmail: string): Promise<{ success?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await requireEditAccess(user?.email);

    const rows = await getVendorNameAddressListing();
    const html = renderVendorNameAddressListingHtml(rows);
    await sendEmail({ to: recipientEmail, subject: "Vendor Name & Address Listing", html });
    return { success: "Sent." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send." };
  }
}
