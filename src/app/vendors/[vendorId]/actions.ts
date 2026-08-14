"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { vendors } from "@/db/schema/vendors";

export interface UpdateVendorDefaultBankAccountState {
  error?: string;
  success?: string;
}

export async function updateVendorDefaultBankAccount(
  vendorId: string,
  _prevState: UpdateVendorDefaultBankAccountState | undefined,
  formData: FormData
): Promise<UpdateVendorDefaultBankAccountState> {
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
  const glCode = formData.get("glCode");

  await db
    .update(vendors)
    .set({ defaultGlCode: typeof glCode === "string" && glCode ? glCode : null })
    .where(eq(vendors.id, vendorId));

  revalidatePath(`/vendors/${vendorId}`);
  return { success: "Default GL code updated." };
}
