"use server";

import { revalidatePath } from "next/cache";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { escrowAnalyses, escrowAnalysisTriggerEnum, trustLedgerEntries } from "@/db/schema/escrow";
import { contracts } from "@/db/schema/contracts";
import { runEscrowAnalysis } from "@/domain/escrow/runEscrowAnalysis";
import { createClient } from "@/lib/supabase/server";
import { requireEditAccess } from "@/lib/staffRole";

export interface RunAnalysisState {
  error?: string;
  success?: string;
}

function dollarsToCents(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isFinite(cents) ? cents : null;
}

export async function runAnalysisAction(
  contractId: string,
  _prevState: RunAnalysisState | undefined,
  formData: FormData
): Promise<RunAnalysisState> {
  const trigger = formData.get("trigger");
  const projectedAnnualTaxCents = dollarsToCents(formData.get("projectedAnnualTax"));
  const projectedAnnualInsuranceCents = dollarsToCents(formData.get("projectedAnnualInsurance"));
  const currentEscrowBalanceCents = dollarsToCents(formData.get("currentEscrowBalance"));
  const currentMonthlyEscrowPaymentCents = dollarsToCents(formData.get("currentMonthlyEscrowPayment"));
  const cushionMonths = Number(formData.get("cushionMonths"));
  const projectionPeriodMonths = Number(formData.get("projectionPeriodMonths"));

  if (!escrowAnalysisTriggerEnum.enumValues.includes(trigger as (typeof escrowAnalysisTriggerEnum.enumValues)[number])) {
    return { error: "Select a valid trigger." };
  }
  if (projectedAnnualTaxCents === null || projectedAnnualTaxCents < 0) {
    return { error: "Enter a valid projected annual tax amount." };
  }
  if (projectedAnnualInsuranceCents === null || projectedAnnualInsuranceCents < 0) {
    return { error: "Enter a valid projected annual insurance amount." };
  }
  if (currentEscrowBalanceCents === null) {
    return { error: "Enter a valid current escrow balance." };
  }
  if (currentMonthlyEscrowPaymentCents === null || currentMonthlyEscrowPaymentCents < 0) {
    return { error: "Enter a valid current monthly escrow payment." };
  }
  if (!Number.isFinite(cushionMonths) || cushionMonths < 0) {
    return { error: "Enter a valid cushion (months)." };
  }
  if (!Number.isFinite(projectionPeriodMonths) || projectionPeriodMonths <= 0) {
    return { error: "Enter a valid projection period." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  const result = runEscrowAnalysis({
    currentEscrowBalanceCents,
    currentMonthlyEscrowPaymentCents,
    projectedAnnualTaxCents,
    projectedAnnualInsuranceCents,
    cushionMonths,
    projectionPeriodMonths,
  });

  const today = new Date().toISOString().slice(0, 10);

  await db.transaction(async (tx) => {
    await tx.insert(escrowAnalyses).values({
      contractId,
      analysisDate: today,
      effectiveDate: today,
      trigger: trigger as (typeof escrowAnalysisTriggerEnum.enumValues)[number],
      projectionPeriodMonths: String(projectionPeriodMonths),
      cushionMonths: cushionMonths.toFixed(1),
      projectedAnnualTaxCents,
      projectedAnnualInsuranceCents,
      cushionTargetCents: result.cushionTargetCents,
      currentEscrowBalanceCents,
      currentMonthlyEscrowPaymentCents,
      projectedEndingBalanceCents: result.projectedEndingBalanceCents,
      shortageOrSurplusCents: result.shortageOrSurplusCents,
      newMonthlyEscrowPaymentCents: result.newMonthlyEscrowPaymentCents,
    });

    // Running an analysis is the deliberate act of arriving at a new
    // billed payment — apply it, rather than letting it sit as a purely
    // historical row nothing else ever reads (the original gap: this
    // action used to have zero effect on what a borrower actually gets
    // charged). Also corrects the real trust-ledger balance if the typed
    // "Current Escrow Balance" doesn't match what's on file — e.g. after
    // reconciling against a bank statement.
    await tx.update(contracts).set({ monthlyEscrowPaymentCents: result.newMonthlyEscrowPaymentCents }).where(eq(contracts.id, contractId));

    const [latestTrustEntry] = await tx
      .select({ balanceCents: trustLedgerEntries.balanceCents })
      .from(trustLedgerEntries)
      .where(eq(trustLedgerEntries.contractId, contractId))
      .orderBy(desc(trustLedgerEntries.transactionDate), desc(trustLedgerEntries.id))
      .limit(1);
    const currentBalanceCents = latestTrustEntry?.balanceCents ?? 0;

    if (currentEscrowBalanceCents !== currentBalanceCents) {
      const deltaCents = currentEscrowBalanceCents - currentBalanceCents;
      await tx.insert(trustLedgerEntries).values({
        contractId,
        transactionDate: today,
        description: "Escrow balance correction (Run Escrow Analysis)",
        amountReceivedCents: deltaCents > 0 ? deltaCents : null,
        amountPaidOutCents: deltaCents < 0 ? -deltaCents : null,
        balanceCents: currentEscrowBalanceCents,
        category: "IMPOUND",
      });
    }
  });

  revalidatePath(`/contracts/${contractId}/escrow-analysis`);
  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/escrow-maintenance");
  return { success: "Analysis run and saved — the new monthly payment is now what's billed going forward." };
}
