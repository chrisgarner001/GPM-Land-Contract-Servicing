"use server";

import { revalidatePath } from "next/cache";
import { processLenderDistribution, overridePaymentRelease } from "@/server/lenderPaymentRuns";
import { createClient } from "@/lib/supabase/server";
import { requireEditAccess } from "@/lib/staffRole";

export interface ProcessDistributionState {
  error?: string;
  success?: string;
}

export async function processLenderDistributionAction(
  lenderPartyId: string,
  _prevState: ProcessDistributionState | undefined,
  formData: FormData
): Promise<ProcessDistributionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  const runDate = formData.get("runDate");
  const sweepBaselineDate = formData.get("sweepBaseline");
  const paymentMethod = formData.get("paymentMethod");
  const checkNumber = formData.get("checkNumber");

  if (typeof runDate !== "string" || !runDate) {
    return { error: "Run date is required." };
  }
  if (typeof sweepBaselineDate !== "string" || !sweepBaselineDate) {
    return { error: "Last Sweep date is required." };
  }
  if (paymentMethod !== "CHECK" && paymentMethod !== "ACH") {
    return { error: "Select a payment method." };
  }
  if (paymentMethod === "CHECK" && (typeof checkNumber !== "string" || !checkNumber.trim())) {
    return { error: "Enter a check number." };
  }

  try {
    await processLenderDistribution({
      lenderPartyId,
      runDate,
      sweepBaselineDate,
      paymentMethod,
      checkNumber: typeof checkNumber === "string" ? checkNumber : undefined,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to process distribution." };
  }

  revalidatePath("/lenders/print-statements");
  return { success: `Processed — ${paymentMethod === "CHECK" ? "check" : "ACH"} recorded.` };
}

export interface OverrideReleaseState {
  error?: string;
  success?: string;
}

export async function overridePaymentReleaseAction(
  paymentId: string,
  _prevState: OverrideReleaseState | undefined
): Promise<OverrideReleaseState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  try {
    await overridePaymentRelease(paymentId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to override this payment's release hold." };
  }

  revalidatePath("/lenders/print-statements");
  return { success: "Included." };
}
