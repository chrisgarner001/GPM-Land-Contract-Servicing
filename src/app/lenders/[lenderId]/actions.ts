"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { parties } from "@/db/schema/parties";
import { partyNotes } from "@/db/schema/notes";
import { createClient } from "@/lib/supabase/server";
import { encryptPII, decryptPII } from "@/lib/encryption";
import { requireEditAccess } from "@/lib/staffRole";

export interface UpdateLenderContactState {
  error?: string;
  success?: string;
}

function trimmedOrNull(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function updateLenderContact(
  lenderId: string,
  _prevState: UpdateLenderContactState | undefined,
  formData: FormData
): Promise<UpdateLenderContactState> {
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
    .update(parties)
    .set({
      firstName: trimmedOrNull(formData.get("firstName")),
      lastName: trimmedOrNull(formData.get("lastName")),
      companyName: trimmedOrNull(formData.get("companyName")),
      email: trimmedOrNull(formData.get("email")),
      phone: trimmedOrNull(formData.get("phone")),
      mailingAddressLine1: trimmedOrNull(formData.get("mailingAddressLine1")),
      mailingAddressLine2: trimmedOrNull(formData.get("mailingAddressLine2")),
      mailingCity: trimmedOrNull(formData.get("mailingCity")),
      mailingState: trimmedOrNull(formData.get("mailingState")),
      mailingZip: trimmedOrNull(formData.get("mailingZip")),
      updatedAt: new Date(),
    })
    .where(eq(parties.id, lenderId));

  revalidatePath(`/lenders/${lenderId}`);
  return { success: "Contact info updated." };
}

export interface UpdateSensitiveInfoState {
  error?: string;
  success?: string;
}

// Full SSN/TIN and full ACH account number are only re-encrypted when a new
// value is actually typed in — an empty field leaves the existing encrypted
// value (and its last-4 display) untouched rather than clearing it.
export async function updateLenderSensitiveInfo(
  lenderId: string,
  _prevState: UpdateSensitiveInfoState | undefined,
  formData: FormData
): Promise<UpdateSensitiveInfoState> {
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
  const achBankName = trimmedOrNull(formData.get("achBankName"));
  const achRoutingNumber = trimmedOrNull(formData.get("achRoutingNumber"));
  const achAccountNumber = trimmedOrNull(formData.get("achAccountNumber"));

  await db
    .update(parties)
    .set({
      ...(taxId
        ? { taxIdEncrypted: encryptPII(taxId), taxIdLast4: taxId.slice(-4) }
        : {}),
      achBankName,
      achRoutingNumber,
      ...(achAccountNumber
        ? { achAccountNumberEncrypted: encryptPII(achAccountNumber), achAccountLast4: achAccountNumber.slice(-4) }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(parties.id, lenderId));

  revalidatePath(`/lenders/${lenderId}`);
  return { success: "Saved." };
}

export async function revealLenderTaxId(lenderId: string): Promise<string | null> {
  const [party] = await db.select({ taxIdEncrypted: parties.taxIdEncrypted }).from(parties).where(eq(parties.id, lenderId));
  if (!party?.taxIdEncrypted) return null;
  return decryptPII(party.taxIdEncrypted);
}

export async function revealLenderAchAccount(lenderId: string): Promise<string | null> {
  const [party] = await db
    .select({ achAccountNumberEncrypted: parties.achAccountNumberEncrypted })
    .from(parties)
    .where(eq(parties.id, lenderId));
  if (!party?.achAccountNumberEncrypted) return null;
  return decryptPII(party.achAccountNumberEncrypted);
}

export interface UpdateDriveFolderState {
  error?: string;
  success?: string;
}

export async function updateLenderDriveFolder(
  lenderId: string,
  _prevState: UpdateDriveFolderState | undefined,
  formData: FormData
): Promise<UpdateDriveFolderState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  const url = formData.get("googleDriveFolderUrl");
  const trimmed = typeof url === "string" ? url.trim() : "";
  if (trimmed && !/^https:\/\/.+/.test(trimmed)) {
    return { error: "Enter a valid https:// link." };
  }

  await db.update(parties).set({ googleDriveFolderUrl: trimmed || null }).where(eq(parties.id, lenderId));

  revalidatePath(`/lenders/${lenderId}`);
  return { success: "Documents link updated." };
}

export interface UpdateDefaultBankAccountState {
  error?: string;
  success?: string;
}

export async function updateLenderDefaultBankAccount(
  lenderId: string,
  _prevState: UpdateDefaultBankAccountState | undefined,
  formData: FormData
): Promise<UpdateDefaultBankAccountState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  const bankAccountId = formData.get("bankAccountId");
  const preferredPaymentMethod = formData.get("preferredPaymentMethod");

  await db
    .update(parties)
    .set({
      defaultBankAccountId: typeof bankAccountId === "string" && bankAccountId ? bankAccountId : null,
      preferredPaymentMethod: preferredPaymentMethod === "CHECK" || preferredPaymentMethod === "ACH" ? preferredPaymentMethod : null,
    })
    .where(eq(parties.id, lenderId));

  revalidatePath(`/lenders/${lenderId}`);
  return { success: "Default bank account updated." };
}

export interface UpdateLenderPortalPinState {
  error?: string;
  success?: string;
}

export async function updateLenderPortalPin(
  lenderId: string,
  _prevState: UpdateLenderPortalPinState | undefined,
  formData: FormData
): Promise<UpdateLenderPortalPinState> {
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
    .update(parties)
    .set({ portalPin: trimmedOrNull(formData.get("portalPin")), updatedAt: new Date() })
    .where(eq(parties.id, lenderId));

  revalidatePath(`/lenders/${lenderId}`);
  return { success: "Portal PIN updated." };
}

export interface SetLenderPortalDeactivatedState {
  error?: string;
  success?: string;
}

export async function deactivateLenderPortalAction(
  lenderId: string,
  _prevState: SetLenderPortalDeactivatedState | undefined,
  _formData: FormData
): Promise<SetLenderPortalDeactivatedState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  await db.update(parties).set({ portalDeactivated: true, updatedAt: new Date() }).where(eq(parties.id, lenderId));
  revalidatePath(`/lenders/${lenderId}`);
  return { success: "Portal access deactivated." };
}

export async function reactivateLenderPortalAction(
  lenderId: string,
  _prevState: SetLenderPortalDeactivatedState | undefined,
  _formData: FormData
): Promise<SetLenderPortalDeactivatedState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  await db.update(parties).set({ portalDeactivated: false, updatedAt: new Date() }).where(eq(parties.id, lenderId));
  revalidatePath(`/lenders/${lenderId}`);
  return { success: "Portal access reactivated." };
}

export interface AddPartyNoteState {
  error?: string;
}

export async function addLenderNote(
  lenderId: string,
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

  await db.insert(partyNotes).values({ partyId: lenderId, authorEmail: user?.email ?? null, body: body.trim() });

  revalidatePath(`/lenders/${lenderId}`);
  return {};
}
