"use server";

import { createClient } from "@/lib/supabase/server";
import { getVendorOptions, getVendorUnpaidCharges, renderVendorUnpaidChargesHtml } from "@/server/vendorReports";
import { sendEmail } from "@/lib/resend";
import { requireEditAccess } from "@/lib/staffRole";

async function getVendorName(vendorId: string): Promise<string> {
  const options = await getVendorOptions();
  return options.find((v) => v.id === vendorId)?.displayName ?? "Unknown Vendor";
}

export async function emailVendorUnpaidChargesAction(
  vendorId: string,
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

    const [data] = await getVendorUnpaidCharges([vendorId], startDate, endDate);
    const vendorName = await getVendorName(vendorId);
    const html = renderVendorUnpaidChargesHtml(vendorName, data, startDate, endDate);
    await sendEmail({ to: recipientEmail, subject: `Unpaid Charges — ${vendorName}`, html });
    return { success: "Sent." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send." };
  }
}
