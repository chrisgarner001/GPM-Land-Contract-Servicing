"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts, loanTypeEnum } from "@/db/schema/contracts";
import { contractNotes } from "@/db/schema/notes";
import { paymentMethodEnum } from "@/db/schema/payments";
import { createClient } from "@/lib/supabase/server";
import { recordPayment, reversePayment, recordPrincipalPaydown } from "@/server/payments";
import { cancelContract, deleteContractHard } from "@/server/contractDeletion";
import { redirect } from "next/navigation";

export interface MakePaymentState {
  error?: string;
  success?: string;
}

export async function makePayment(
  contractId: string,
  _prevState: MakePaymentState | undefined,
  formData: FormData
): Promise<MakePaymentState> {
  const receivedDate = formData.get("receivedDate");
  const amountDollars = formData.get("amount");
  const escrowDollars = formData.get("escrowPortion");
  const lateFeeDollars = formData.get("lateFee");
  const chargePaymentDollars = formData.get("chargePayment");
  const paymentMethod = formData.get("paymentMethod");
  const referenceNumber = formData.get("referenceNumber");
  const applyReserve = formData.get("applyReserve") === "1";

  if (typeof receivedDate !== "string" || !receivedDate) {
    return { error: "Date received is required." };
  }
  const amountCents = Math.round(Number(amountDollars) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { error: "Enter a valid payment amount." };
  }
  const escrowPortionCents = escrowDollars ? Math.round(Number(escrowDollars) * 100) : 0;
  if (!Number.isFinite(escrowPortionCents) || escrowPortionCents < 0) {
    return { error: "Enter a valid escrow portion." };
  }
  // Staff can override the system-suggested late fee (waive it, or apply a
  // different amount) — this is the value actually applied, not recomputed.
  const lateFeeCents = lateFeeDollars ? Math.round(Number(lateFeeDollars) * 100) : 0;
  if (!Number.isFinite(lateFeeCents) || lateFeeCents < 0) {
    return { error: "Enter a valid late fee." };
  }
  const chargePaymentCents = chargePaymentDollars ? Math.round(Number(chargePaymentDollars) * 100) : 0;
  if (!Number.isFinite(chargePaymentCents) || chargePaymentCents < 0) {
    return { error: "Enter a valid charge payment amount." };
  }
  const method = paymentMethodEnum.enumValues.includes(paymentMethod as (typeof paymentMethodEnum.enumValues)[number])
    ? (paymentMethod as (typeof paymentMethodEnum.enumValues)[number])
    : "CHECK";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let result;
  try {
    result = await recordPayment({
      contractId,
      receivedDate,
      amountCents,
      paymentMethod: method,
      referenceNumber: typeof referenceNumber === "string" && referenceNumber ? referenceNumber : null,
      escrowPortionCents,
      lateFeeCents,
      chargePaymentCents,
      applyReserve,
      actorEmail: user?.email ?? null,
    });
  } catch {
    return { error: "Contract not found." };
  }

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath(`/contracts/${contractId}/history`);
  revalidatePath(`/contracts`);
  revalidatePath("/lenders");

  return {
    success: result.heldInReserve
      ? "Payment recorded and held in reserve — not yet enough for a full payment."
      : "Payment recorded and applied.",
  };
}

export interface RecordPrincipalPaydownState {
  error?: string;
  success?: string;
}

export async function recordPrincipalPaydownAction(
  contractId: string,
  _prevState: RecordPrincipalPaydownState | undefined,
  formData: FormData
): Promise<RecordPrincipalPaydownState> {
  const receivedDate = formData.get("receivedDate");
  const amountDollars = formData.get("amount");
  const paymentMethod = formData.get("paymentMethod");
  const referenceNumber = formData.get("referenceNumber");

  if (typeof receivedDate !== "string" || !receivedDate) {
    return { error: "Date received is required." };
  }
  const amountCents = Math.round(Number(amountDollars) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { error: "Enter a valid amount." };
  }
  const method = paymentMethodEnum.enumValues.includes(paymentMethod as (typeof paymentMethodEnum.enumValues)[number])
    ? (paymentMethod as (typeof paymentMethodEnum.enumValues)[number])
    : "CHECK";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    await recordPrincipalPaydown({
      contractId,
      receivedDate,
      amountCents,
      paymentMethod: method,
      referenceNumber: typeof referenceNumber === "string" && referenceNumber.trim() ? referenceNumber.trim() : null,
      actorEmail: user?.email ?? null,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to record principal paydown." };
  }

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath(`/contracts/${contractId}/history`);
  revalidatePath(`/contracts`);
  revalidatePath("/lenders");

  return { success: "Principal paydown recorded." };
}

export interface ReversePaymentState {
  error?: string;
  success?: string;
}

// prevState/formData are unused but required by useActionState's expected
// action shape — this form has no fields, just a confirm-and-submit button.
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function reversePaymentAction(
  contractId: string,
  paymentId: string,
  _prevState: ReversePaymentState | undefined,
  _formData: FormData
): Promise<ReversePaymentState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    await reversePayment(paymentId, user?.email ?? null);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to reverse payment." };
  }

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath(`/contracts/${contractId}/history`);
  revalidatePath(`/contracts`);

  return { success: "Payment reversed." };
}

export interface AddNoteState {
  error?: string;
}

export async function addNote(
  contractId: string,
  _prevState: AddNoteState | undefined,
  formData: FormData
): Promise<AddNoteState> {
  const body = formData.get("body");
  if (typeof body !== "string" || !body.trim()) {
    return { error: "Note cannot be empty." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await db.insert(contractNotes).values({ contractId, authorEmail: user?.email ?? null, body: body.trim() });

  revalidatePath(`/contracts/${contractId}`);
  return {};
}

export interface UpdateCourtStatusState {
  error?: string;
  success?: string;
}

function dateOrNull(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value ? value : null;
}

const LEGAL_PROCESS_STAGES = ["COURT", "FORECLOSED", "FORFEITED"] as const;

function legalProcessStageOrNull(value: FormDataEntryValue | null): (typeof LEGAL_PROCESS_STAGES)[number] | null {
  return typeof value === "string" && (LEGAL_PROCESS_STAGES as readonly string[]).includes(value)
    ? (value as (typeof LEGAL_PROCESS_STAGES)[number])
    : null;
}

export async function updateCourtStatus(
  contractId: string,
  _prevState: UpdateCourtStatusState | undefined,
  formData: FormData
): Promise<UpdateCourtStatusState> {
  await db
    .update(contracts)
    .set({
      forfeitureNoticeSentDate: dateOrNull(formData.get("forfeitureNoticeSentDate")),
      courtHearingDate: dateOrNull(formData.get("courtHearingDate")),
      judgmentReceivedDate: dateOrNull(formData.get("judgmentReceivedDate")),
      evictionDate: dateOrNull(formData.get("evictionDate")),
      legalProcessStage: legalProcessStageOrNull(formData.get("legalProcessStage")),
      inBankruptcy: formData.get("inBankruptcy") === "1",
    })
    .where(eq(contracts.id, contractId));

  revalidatePath(`/contracts/${contractId}`);
  return { success: "Court status updated." };
}

export interface UpdateLoanTypeState {
  error?: string;
  success?: string;
}

export async function updateLoanType(
  contractId: string,
  _prevState: UpdateLoanTypeState | undefined,
  formData: FormData
): Promise<UpdateLoanTypeState> {
  const raw = formData.get("loanType");
  if (typeof raw !== "string" || !loanTypeEnum.enumValues.includes(raw as (typeof loanTypeEnum.enumValues)[number])) {
    return { error: "Select a valid loan type." };
  }

  await db
    .update(contracts)
    .set({ loanType: raw as (typeof loanTypeEnum.enumValues)[number] })
    .where(eq(contracts.id, contractId));

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/contracts");
  return { success: "Loan type updated." };
}

export interface UpdateDriveFolderState {
  error?: string;
  success?: string;
}

export async function updateDriveFolderLink(
  contractId: string,
  _prevState: UpdateDriveFolderState | undefined,
  formData: FormData
): Promise<UpdateDriveFolderState> {
  const url = formData.get("googleDriveFolderUrl");
  const trimmed = typeof url === "string" ? url.trim() : "";
  if (trimmed && !/^https:\/\/.+/.test(trimmed)) {
    return { error: "Enter a valid https:// link." };
  }

  await db
    .update(contracts)
    .set({ googleDriveFolderUrl: trimmed || null })
    .where(eq(contracts.id, contractId));

  revalidatePath(`/contracts/${contractId}`);
  return { success: "Attachments link updated." };
}

export interface CancelContractState {
  error?: string;
}

export async function cancelContractAction(contractId: string, _prevState: CancelContractState | undefined): Promise<CancelContractState> {
  await cancelContract(contractId);
  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/contracts");
  redirect("/contracts");
}

export interface DeleteContractState {
  error?: string;
}

export async function deleteContractAction(contractId: string, _prevState: DeleteContractState | undefined): Promise<DeleteContractState> {
  try {
    await deleteContractHard(contractId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete contract." };
  }
  revalidatePath("/contracts");
  redirect("/contracts");
}
