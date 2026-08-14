"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { partyEmailDrafts } from "@/db/schema/notes";
import { createClient } from "@/lib/supabase/server";

export interface ComposeEmailState {
  error?: string;
  success?: string;
}

// Shared by the Borrower and Lender detail pages — both are `parties` rows,
// so the same draft queue/review workflow applies to either. The app never
// sends email directly; this only queues a PENDING row for an admin to turn
// into a real Gmail draft (from info@successgroupmortgage.com) for review.
export async function composeEmail(
  partyId: string,
  revalidateBasePath: string,
  _prevState: ComposeEmailState | undefined,
  formData: FormData
): Promise<ComposeEmailState> {
  const toAddress = formData.get("toAddress");
  const ccAddressRaw = formData.get("ccAddress");
  const bccAddressRaw = formData.get("bccAddress");
  const subject = formData.get("subject");
  const body = formData.get("body");

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (typeof toAddress !== "string" || !toAddress.trim()) {
    return { error: "Recipient email is required." };
  }
  if (!emailPattern.test(toAddress.trim())) {
    return { error: "Enter a valid recipient email address." };
  }

  const ccAddress = typeof ccAddressRaw === "string" && ccAddressRaw.trim() ? ccAddressRaw.trim() : null;
  if (ccAddress && !ccAddress.split(",").every((addr) => emailPattern.test(addr.trim()))) {
    return { error: "Enter valid CC email address(es), separated by commas." };
  }

  const bccAddress = typeof bccAddressRaw === "string" && bccAddressRaw.trim() ? bccAddressRaw.trim() : null;
  if (bccAddress && !bccAddress.split(",").every((addr) => emailPattern.test(addr.trim()))) {
    return { error: "Enter valid BCC email address(es), separated by commas." };
  }

  if (typeof subject !== "string" || !subject.trim()) {
    return { error: "Subject is required." };
  }
  if (typeof body !== "string" || !body.trim()) {
    return { error: "Message body cannot be empty." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await db.insert(partyEmailDrafts).values({
    partyId,
    toAddress: toAddress.trim(),
    ccAddress,
    bccAddress,
    subject: subject.trim(),
    body: body.trim(),
    authorEmail: user?.email ?? null,
  });

  revalidatePath(`${revalidateBasePath}/${partyId}`);
  return { success: "Queued — an admin will create the Gmail draft for review and sending shortly." };
}
