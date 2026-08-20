"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireEditAccess } from "@/lib/staffRole";
import { saveDraft, publishPackage } from "@/server/landContractPackages";
import { lookupPropertyByAddress } from "@/lib/assessorSearch";
import { extractClosingDisclosureData, type ExtractedClosingDisclosure } from "@/server/closingDisclosureExtraction";
import type { Answers } from "@/domain/landContractPackage/answers";

export interface SubmitPackageState {
  error?: string;
  success?: string;
  driveFolderUrl?: string;
}

function collectAnswers(formData: FormData): Answers {
  const answers: Answers = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && key !== "intent") answers[key] = value;
  }
  return answers;
}

// Single action for both buttons — the submit button that triggered
// submission includes its own name="intent" value in the FormData, so one
// action + one useActionState covers Save Draft and Publish without
// duplicating every field across two forms.
export async function submitPackageAction(
  id: string,
  _prevState: SubmitPackageState | undefined,
  formData: FormData
): Promise<SubmitPackageState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  const intent = formData.get("intent");
  const answers = collectAnswers(formData);

  if (intent === "publish") {
    if (!answers.buyer_name?.trim()) return { error: "Buyer Name is required before publishing." };
    if (!answers.property_street?.trim()) return { error: "Property Street Address is required before publishing." };
    if (!answers.seller_name?.trim()) return { error: "Seller Name is required before publishing." };
    if (!answers.closing_date?.trim()) return { error: "Closing Date is required before publishing." };

    try {
      const result = await publishPackage(id, answers, user?.email ?? null);
      revalidatePath(`/onboarding/land-contract-package/${id}`);
      revalidatePath("/onboarding/land-contract-package");
      return { success: "Package published to Google Drive.", driveFolderUrl: result.driveFolderUrl };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Failed to publish package." };
    }
  }

  try {
    await saveDraft(id, answers, user?.email ?? null);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save draft." };
  }
  revalidatePath(`/onboarding/land-contract-package/${id}`);
  revalidatePath("/onboarding/land-contract-package");
  return { success: "Draft saved." };
}

export interface AssessorLookupResult {
  error?: string;
  county?: string;
  legalDescription?: string;
  parcelId?: string;
  ownerFullName?: string;
  annualTax?: string;
}

// Core-record-only lookup (no lien/mortgage detail endpoint) — used to
// prefill county/legal description/parcel ID and to surface the assessor's
// owner-of-record so staff can visually confirm it matches the expected
// seller before publishing a real closing package.
export async function assessorLookupAction(address: string): Promise<AssessorLookupResult> {
  try {
    const record = await lookupPropertyByAddress(address);
    if (!record) return { error: "No AssessorSearch match found for this address." };
    return {
      county: record.county ?? undefined,
      legalDescription: record.legalDescription ?? undefined,
      parcelId: record.apn ?? undefined,
      ownerFullName: record.ownerFullName ?? undefined,
      annualTax: record.annualTaxAmountCents !== null ? (record.annualTaxAmountCents / 100).toFixed(2) : undefined,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "AssessorSearch lookup failed." };
  }
}

export interface ClosingDisclosureCompareResult {
  error?: string;
  data?: ExtractedClosingDisclosure;
}

// Read-only — doesn't touch the package's saved data, so no edit-access
// guard (matches assessorLookupAction above). The uploaded PDF itself is
// already sitting in the form's own hidden fields; this just reads it back
// for the live comparison table.
export async function compareClosingDisclosureAction(base64Pdf: string): Promise<ClosingDisclosureCompareResult> {
  try {
    const data = await extractClosingDisclosureData(base64Pdf);
    return { data };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to read the Closing Disclosure. Try again." };
  }
}
