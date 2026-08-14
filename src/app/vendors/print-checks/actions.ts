"use server";

import { redirect } from "next/navigation";
import { createVendorChecks } from "@/server/printChecks";
import { createClient } from "@/lib/supabase/server";
import { requireEditAccess } from "@/lib/staffRole";

export async function createVendorChecksAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await requireEditAccess(user?.email);

  const disbursementIds = formData.getAll("disbursementIds").map(String);
  const bankAccountId = formData.get("bankAccountId");
  const checkDate = formData.get("checkDate");
  const startingCheckNumber = formData.get("startingCheckNumber");

  if (disbursementIds.length === 0) {
    redirect("/vendors/print-checks?error=" + encodeURIComponent("Select at least one invoice."));
  }
  if (typeof bankAccountId !== "string" || !bankAccountId) {
    redirect("/vendors/print-checks?error=" + encodeURIComponent("Select a bank account."));
  }
  if (typeof checkDate !== "string" || !checkDate) {
    redirect("/vendors/print-checks?error=" + encodeURIComponent("Check date is required."));
  }
  const startingNumber = Number(startingCheckNumber);
  if (!Number.isInteger(startingNumber) || startingNumber <= 0) {
    redirect("/vendors/print-checks?error=" + encodeURIComponent("Enter the starting check number loaded in the printer."));
  }

  const newCheckIds = await createVendorChecks({
    disbursementIds,
    bankAccountId: bankAccountId as string,
    checkDate: checkDate as string,
    startingCheckNumber: startingNumber,
  });

  redirect(`/checks/print/confirm?ids=${newCheckIds.join(",")}&returnTo=${encodeURIComponent("/vendors/print-checks")}`);
}
