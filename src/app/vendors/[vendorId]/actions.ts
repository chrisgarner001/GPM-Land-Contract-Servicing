"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { vendors } from "@/db/schema/vendors";
import { createClient } from "@/lib/supabase/server";
import { requireEditAccess } from "@/lib/staffRole";

export interface UpdateVendorDefaultBankAccountState {
  error?: string;
  success?: string;
}

export async function updateVendorDefaultBankAccount(
  vendorId: string,
  _prevState: UpdateVendorDefaultBankAccountState | undefined,
  formData: FormData
): Promise<UpdateVendorDefaultBankAccountState> {
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

  await db
    .update(vendors)
    .set({ defaultBankAccountId: typeof bankAccountId === "string" && bankAccountId ? bankAccountId : null })
    .where(eq(vendors.id, vendorId));

  revalidatePath(`/vendors/${vendorId}`);
  return { success: "Default bank account updated." };
}

export interface UpdateVendorDefaultGlCodeState {
  error?: string;
  success?: string;
}

export async function updateVendorDefaultGlCode(
  vendorId: string,
  _prevState: UpdateVendorDefaultGlCodeState | undefined,
  formData: FormData
): Promise<UpdateVendorDefaultGlCodeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  const glCode = formData.get("glCode");

  await db
    .update(vendors)
    .set({ defaultGlCode: typeof glCode === "string" && glCode ? glCode : null })
    .where(eq(vendors.id, vendorId));

  revalidatePath(`/vendors/${vendorId}`);
  return { success: "Default GL code updated." };
}

export interface SetVendorDeactivatedState {
  error?: string;
  success?: string;
}

export async function deactivateVendorAction(
  vendorId: string,
  _prevState: SetVendorDeactivatedState | undefined,
  _formData: FormData
): Promise<SetVendorDeactivatedState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  await db.update(vendors).set({ deactivated: true }).where(eq(vendors.id, vendorId));
  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath("/vendors");
  return { success: "Vendor deactivated." };
}

export async function reactivateVendorAction(
  vendorId: string,
  _prevState: SetVendorDeactivatedState | undefined,
  _formData: FormData
): Promise<SetVendorDeactivatedState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  await db.update(vendors).set({ deactivated: false }).where(eq(vendors.id, vendorId));
  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath("/vendors");
  return { success: "Vendor reactivated." };
}
