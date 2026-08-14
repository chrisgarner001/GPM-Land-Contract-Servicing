"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { escrowAnalyses, escrowAnalysisTriggerEnum } from "@/db/schema/escrow";
import { runEscrowAnalysis } from "@/domain/escrow/runEscrowAnalysis";

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

  const result = runEscrowAnalysis({
    currentEscrowBalanceCents,
    currentMonthlyEscrowPaymentCents,
    projectedAnnualTaxCents,
    projectedAnnualInsuranceCents,
    cushionMonths,
    projectionPeriodMonths,
  });

  const today = new Date().toISOString().slice(0, 10);

  await db.insert(escrowAnalyses).values({
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

  revalidatePath(`/contracts/${contractId}/escrow-analysis`);
  return { success: "Analysis run and saved." };
}
