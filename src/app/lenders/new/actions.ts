"use server";

import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { parties, partyTypeEnum } from "@/db/schema/parties";
import { encryptPII } from "@/lib/encryption";

export interface AddLenderState {
  error?: string;
}

function trimmedOrNull(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function addLender(_prevState: AddLenderState | undefined, formData: FormData): Promise<AddLenderState> {
  const partyTypeRaw = formData.get("partyType");
  const displayName = formData.get("displayName");

  const partyType = partyTypeEnum.enumValues.includes(partyTypeRaw as (typeof partyTypeEnum.enumValues)[number])
    ? (partyTypeRaw as (typeof partyTypeEnum.enumValues)[number])
    : "BUSINESS";

  if (typeof displayName !== "string" || !displayName.trim()) {
    return { error: "Name is required." };
  }

  const taxId = trimmedOrNull(formData.get("taxId"));
  const achAccountNumber = trimmedOrNull(formData.get("achAccountNumber"));

  const [lender] = await db
    .insert(parties)
    .values({
      partyType,
      displayName: displayName.trim(),
      firstName: partyType === "INDIVIDUAL" ? trimmedOrNull(formData.get("firstName")) : null,
      lastName: partyType === "INDIVIDUAL" ? trimmedOrNull(formData.get("lastName")) : null,
      companyName: partyType === "BUSINESS" ? trimmedOrNull(formData.get("companyName")) ?? displayName.trim() : null,
      email: trimmedOrNull(formData.get("email")),
      phone: trimmedOrNull(formData.get("phone")),
      mailingAddressLine1: trimmedOrNull(formData.get("mailingAddressLine1")),
      mailingCity: trimmedOrNull(formData.get("mailingCity")),
      mailingState: trimmedOrNull(formData.get("mailingState")),
      mailingZip: trimmedOrNull(formData.get("mailingZip")),
      portalPin: trimmedOrNull(formData.get("portalPin")),
      // Lenders earn interest income and need a 1099 — default this on for
      // every new lender rather than leaving it off like the borrower-side
      // default (confirmed business rule).
      sendTaxReporting: true,
      preferredPaymentMethod:
        formData.get("preferredPaymentMethod") === "CHECK" || formData.get("preferredPaymentMethod") === "ACH"
          ? (formData.get("preferredPaymentMethod") as "CHECK" | "ACH")
          : null,
      ...(taxId ? { taxIdEncrypted: encryptPII(taxId), taxIdLast4: taxId.slice(-4) } : {}),
      achBankName: trimmedOrNull(formData.get("achBankName")),
      achRoutingNumber: trimmedOrNull(formData.get("achRoutingNumber")),
      ...(achAccountNumber
        ? { achAccountNumberEncrypted: encryptPII(achAccountNumber), achAccountLast4: achAccountNumber.slice(-4) }
        : {}),
    })
    .returning();

  redirect(`/lenders/${lender.id}`);
}
