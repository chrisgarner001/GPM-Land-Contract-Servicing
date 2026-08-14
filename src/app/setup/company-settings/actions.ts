"use server";

import { revalidatePath } from "next/cache";
import { updateCompanySettings } from "@/server/companySettings";

export interface UpdateCompanySettingsState {
  error?: string;
  success?: string;
}

function trimmedOrNull(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function dollarsToCents(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isFinite(cents) ? cents : null;
}

export async function updateCompanySettingsAction(
  id: string,
  _prevState: UpdateCompanySettingsState | undefined,
  formData: FormData
): Promise<UpdateCompanySettingsState> {
  const companyName = trimmedOrNull(formData.get("companyName"));
  const preparerFirmName = trimmedOrNull(formData.get("preparerFirmName"));
  if (!companyName) return { error: "Company Name is required." };
  if (!preparerFirmName) return { error: "Document Preparer Firm Name is required." };

  await updateCompanySettings(id, {
    companyName,
    companyAddressLine1: trimmedOrNull(formData.get("companyAddressLine1")) ?? "",
    companyCity: trimmedOrNull(formData.get("companyCity")) ?? "",
    companyState: trimmedOrNull(formData.get("companyState")) ?? "",
    companyZip: trimmedOrNull(formData.get("companyZip")) ?? "",
    companyNmlsId: trimmedOrNull(formData.get("companyNmlsId")),
    preparerFirmName,
    preparerAttorneyName: trimmedOrNull(formData.get("preparerAttorneyName")) ?? "",
    preparerAddressLine1: trimmedOrNull(formData.get("preparerAddressLine1")) ?? "",
    preparerCity: trimmedOrNull(formData.get("preparerCity")) ?? "",
    preparerState: trimmedOrNull(formData.get("preparerState")) ?? "",
    preparerZip: trimmedOrNull(formData.get("preparerZip")) ?? "",
    titleFeeCents: dollarsToCents(formData.get("titleFee")),
    defaultContactName: trimmedOrNull(formData.get("defaultContactName")) ?? "",
    defaultContactAddressLine1: trimmedOrNull(formData.get("defaultContactAddressLine1")) ?? "",
    defaultContactCity: trimmedOrNull(formData.get("defaultContactCity")) ?? "",
    defaultContactState: trimmedOrNull(formData.get("defaultContactState")) ?? "",
    defaultContactZip: trimmedOrNull(formData.get("defaultContactZip")) ?? "",
    defaultNotaryState: trimmedOrNull(formData.get("defaultNotaryState")) ?? "Michigan",
  });

  revalidatePath("/setup/company-settings");
  revalidatePath("/documents");
  revalidatePath("/onboarding/land-contract-package");
  return { success: "Company settings updated." };
}
