"use server";

import { getNameAddressListing, renderNameAddressListingHtml } from "@/server/borrowerReports";
import { sendEmail } from "@/lib/resend";

// Recipient is always staff-entered here (no single "the borrower" to
// default to — this report is every borrower at once).
export async function emailNameAddressListingAction(recipientEmail: string): Promise<{ success?: string; error?: string }> {
  try {
    const rows = await getNameAddressListing();
    const html = renderNameAddressListingHtml(rows);
    await sendEmail({ to: recipientEmail, subject: "Borrower Name & Address Listing", html });
    return { success: "Sent." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send." };
  }
}
