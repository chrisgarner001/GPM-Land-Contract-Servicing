"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { parties, partyTypeEnum } from "@/db/schema/parties";
import { addLenderFunding, updateLenderFunding } from "@/server/funding";

export interface AddLenderFundingState {
  error?: string;
  success?: string;
}

export async function addLenderFundingAction(
  contractId: string,
  _prevState: AddLenderFundingState | undefined,
  formData: FormData
): Promise<AddLenderFundingState> {
  const lenderMode = formData.get("lenderMode");
  const fundingDate = formData.get("fundingDate");
  const fundedAmountDollars = formData.get("fundedAmount");
  const interestRatePercent = formData.get("interestRate");
  const ownershipPercentRaw = formData.get("ownershipPercent");

  if (typeof fundingDate !== "string" || !fundingDate) {
    return { error: "Funding date is required." };
  }
  const fundedAmountCents = Math.round(Number(fundedAmountDollars) * 100);
  if (!Number.isFinite(fundedAmountCents) || fundedAmountCents <= 0) {
    return { error: "Enter a valid funded amount." };
  }
  const rate = Number(interestRatePercent);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    return { error: "Enter a valid interest rate." };
  }
  const ownershipPercent = Number(ownershipPercentRaw);
  if (!Number.isFinite(ownershipPercent) || ownershipPercent <= 0 || ownershipPercent > 100) {
    return { error: "Enter a valid ownership percent (greater than 0, up to 100)." };
  }
  const servicingFeeDollars = formData.get("servicingFee");
  let brokerServicingFeeCents: number | null = null;
  if (typeof servicingFeeDollars === "string" && servicingFeeDollars.trim()) {
    brokerServicingFeeCents = Math.round(Number(servicingFeeDollars) * 100);
    if (!Number.isFinite(brokerServicingFeeCents) || brokerServicingFeeCents < 0) {
      return { error: "Enter a valid servicing fee." };
    }
  }

  let lenderPartyId: string;
  if (lenderMode === "new") {
    const newDisplayName = formData.get("newDisplayName");
    const newPartyType = formData.get("newPartyType");
    if (typeof newDisplayName !== "string" || !newDisplayName.trim()) {
      return { error: "Enter a name for the new lender." };
    }
    const partyType = partyTypeEnum.enumValues.includes(newPartyType as (typeof partyTypeEnum.enumValues)[number])
      ? (newPartyType as (typeof partyTypeEnum.enumValues)[number])
      : "BUSINESS";
    const [created] = await db
      .insert(parties)
      .values({ partyType, displayName: newDisplayName.trim(), sendTaxReporting: true })
      .returning();
    lenderPartyId = created.id;
  } else {
    const existingPartyId = formData.get("existingPartyId");
    if (typeof existingPartyId !== "string" || !existingPartyId) {
      return { error: "Select an existing lender." };
    }
    lenderPartyId = existingPartyId;
  }

  try {
    await addLenderFunding({
      contractId,
      lenderPartyId,
      fundedAmountCents,
      interestRateAnnual: rate.toFixed(4),
      fundingDate,
      ownershipPercent: ownershipPercent.toFixed(2),
      brokerServicingFeeCents,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to record funding." };
  }

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath(`/contracts/${contractId}/funding`);
  revalidatePath("/lenders");

  return { success: "Funding recorded." };
}

export interface UpdateLenderFundingState {
  error?: string;
  success?: string;
}

export async function updateLenderFundingAction(
  contractId: string,
  contractPartyId: string,
  _prevState: UpdateLenderFundingState | undefined,
  formData: FormData
): Promise<UpdateLenderFundingState> {
  const fundingDate = formData.get("fundingDate");
  const fundedAmountDollars = formData.get("fundedAmount");
  const interestRatePercent = formData.get("interestRate");

  if (typeof fundingDate !== "string" || !fundingDate) {
    return { error: "Funding date is required." };
  }
  const fundedAmountCents = Math.round(Number(fundedAmountDollars) * 100);
  if (!Number.isFinite(fundedAmountCents) || fundedAmountCents <= 0) {
    return { error: "Enter a valid funded amount." };
  }
  const rate = Number(interestRatePercent);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    return { error: "Enter a valid interest rate." };
  }
  const servicingFeeDollars = formData.get("servicingFee");
  let brokerServicingFeeCents: number | null = null;
  if (typeof servicingFeeDollars === "string" && servicingFeeDollars.trim()) {
    brokerServicingFeeCents = Math.round(Number(servicingFeeDollars) * 100);
    if (!Number.isFinite(brokerServicingFeeCents) || brokerServicingFeeCents < 0) {
      return { error: "Enter a valid servicing fee." };
    }
  }

  await updateLenderFunding({
    contractPartyId,
    fundedAmountCents,
    interestRateAnnual: rate.toFixed(4),
    fundingDate,
    brokerServicingFeeCents,
  });

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath(`/contracts/${contractId}/funding`);
  revalidatePath("/lenders");

  return { success: "Funding details updated." };
}
