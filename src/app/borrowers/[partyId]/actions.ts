"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { parties, emailFormatEnum, tinTypeEnum } from "@/db/schema/parties";
import { contracts } from "@/db/schema/contracts";
import { partyNotes } from "@/db/schema/notes";
import { createClient } from "@/lib/supabase/server";
import { encryptPII, decryptPII } from "@/lib/encryption";
import { requireEditAccess } from "@/lib/staffRole";

function trimmedOrNull(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export interface AddPartyNoteState {
  error?: string;
}

export async function addPartyNote(
  partyId: string,
  _prevState: AddPartyNoteState | undefined,
  formData: FormData
): Promise<AddPartyNoteState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  const body = formData.get("body");
  if (typeof body !== "string" || !body.trim()) {
    return { error: "Note cannot be empty." };
  }

  await db.insert(partyNotes).values({ partyId, authorEmail: user?.email ?? null, body: body.trim() });

  revalidatePath(`/borrowers/${partyId}`);
  return {};
}

export interface UpdateBorrowerContactInfoState {
  error?: string;
  success?: string;
}

export async function updateBorrowerContactInfo(
  partyId: string,
  _prevState: UpdateBorrowerContactInfoState | undefined,
  formData: FormData
): Promise<UpdateBorrowerContactInfoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  const emailFormatRaw = formData.get("emailFormat");
  const emailFormat = emailFormatEnum.enumValues.includes(emailFormatRaw as (typeof emailFormatEnum.enumValues)[number])
    ? (emailFormatRaw as (typeof emailFormatEnum.enumValues)[number])
    : null;

  await db
    .update(parties)
    .set({
      salutation: trimmedOrNull(formData.get("salutation")),
      firstName: trimmedOrNull(formData.get("firstName")),
      middleInitial: trimmedOrNull(formData.get("middleInitial")),
      lastName: trimmedOrNull(formData.get("lastName")),
      email: trimmedOrNull(formData.get("email")),
      emailFormat,
      phoneHome: trimmedOrNull(formData.get("phoneHome")),
      phoneWork: trimmedOrNull(formData.get("phoneWork")),
      phoneMobile: trimmedOrNull(formData.get("phoneMobile")),
      phoneFax: trimmedOrNull(formData.get("phoneFax")),
      mailingAddressLine1: trimmedOrNull(formData.get("mailingAddressLine1")),
      mailingAddressLine2: trimmedOrNull(formData.get("mailingAddressLine2")),
      mailingCity: trimmedOrNull(formData.get("mailingCity")),
      mailingState: trimmedOrNull(formData.get("mailingState")),
      mailingZip: trimmedOrNull(formData.get("mailingZip")),
      mailingCountry: trimmedOrNull(formData.get("mailingCountry")),
      deliveryByPrint: formData.get("deliveryByPrint") === "1",
      deliveryByEmail: formData.get("deliveryByEmail") === "1",
      deliveryBySms: formData.get("deliveryBySms") === "1",
      updatedAt: new Date(),
    })
    .where(eq(parties.id, partyId));

  revalidatePath(`/borrowers/${partyId}`);
  return { success: "Contact info updated." };
}

export interface UpdateBorrowerTaxInfoState {
  error?: string;
  success?: string;
}

// TIN is only re-encrypted when a new value is actually typed — same
// "leave blank to keep value on file" convention as the Lenders sensitive
// info form.
export async function updateBorrowerTaxInfo(
  partyId: string,
  _prevState: UpdateBorrowerTaxInfoState | undefined,
  formData: FormData
): Promise<UpdateBorrowerTaxInfoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  const taxId = trimmedOrNull(formData.get("taxId"));
  const tinTypeRaw = formData.get("tinType");
  const tinType = tinTypeEnum.enumValues.includes(tinTypeRaw as (typeof tinTypeEnum.enumValues)[number])
    ? (tinTypeRaw as (typeof tinTypeEnum.enumValues)[number])
    : null;

  await db
    .update(parties)
    .set({
      legalStructure: trimmedOrNull(formData.get("legalStructure")),
      dateOfBirth: trimmedOrNull(formData.get("dateOfBirth")),
      tinType,
      onHold: formData.get("onHold") === "1",
      alternateTaxInfo: trimmedOrNull(formData.get("alternateTaxInfo")),
      sendTaxReporting: formData.get("sendTaxReporting") === "1",
      sendLateNotices: formData.get("sendLateNotices") === "1",
      sendPaymentReceipts: formData.get("sendPaymentReceipts") === "1",
      sendPaymentStatements: formData.get("sendPaymentStatements") === "1",
      ...(taxId ? { taxIdEncrypted: encryptPII(taxId), taxIdLast4: taxId.slice(-4) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(parties.id, partyId));

  revalidatePath(`/borrowers/${partyId}`);
  return { success: "Tax info updated." };
}

export async function revealBorrowerTaxId(partyId: string): Promise<string | null> {
  const [party] = await db.select({ taxIdEncrypted: parties.taxIdEncrypted }).from(parties).where(eq(parties.id, partyId));
  if (!party?.taxIdEncrypted) return null;
  return decryptPII(party.taxIdEncrypted);
}

export interface UpdateBorrowerPortalPinState {
  error?: string;
  success?: string;
}

// Portal PIN lives on contracts, not parties (shared per loan account by
// co-buyers) — a separate action/table from the rest of Contact Info.
export async function updateBorrowerPortalPinAction(
  partyId: string,
  contractId: string,
  _prevState: UpdateBorrowerPortalPinState | undefined,
  formData: FormData
): Promise<UpdateBorrowerPortalPinState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  await db
    .update(contracts)
    .set({ borrowerPortalPin: trimmedOrNull(formData.get("portalPin")), updatedAt: new Date() })
    .where(eq(contracts.id, contractId));

  revalidatePath(`/borrowers/${partyId}`);
  return { success: "Portal PIN updated." };
}

export interface SetBorrowerPortalDeactivatedState {
  error?: string;
  success?: string;
}

export async function deactivateBorrowerPortalAction(
  partyId: string,
  contractId: string,
  _prevState: SetBorrowerPortalDeactivatedState | undefined,
  _formData: FormData
): Promise<SetBorrowerPortalDeactivatedState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  await db.update(contracts).set({ borrowerPortalDeactivated: true, updatedAt: new Date() }).where(eq(contracts.id, contractId));
  revalidatePath(`/borrowers/${partyId}`);
  return { success: "Portal access deactivated." };
}

export async function reactivateBorrowerPortalAction(
  partyId: string,
  contractId: string,
  _prevState: SetBorrowerPortalDeactivatedState | undefined,
  _formData: FormData
): Promise<SetBorrowerPortalDeactivatedState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  await db.update(contracts).set({ borrowerPortalDeactivated: false, updatedAt: new Date() }).where(eq(contracts.id, contractId));
  revalidatePath(`/borrowers/${partyId}`);
  return { success: "Portal access reactivated." };
}
