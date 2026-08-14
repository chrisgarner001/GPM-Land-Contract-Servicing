"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { vendors } from "@/db/schema/vendors";
import { createClient } from "@/lib/supabase/server";
import { requireEditAccess } from "@/lib/staffRole";

export interface AddVendorState {
  error?: string;
}

export async function addVendor(_prevState: AddVendorState | undefined, formData: FormData): Promise<AddVendorState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  const vendorAccountCode = formData.get("vendorAccountCode");
  const displayName = formData.get("displayName");
  const referenceLine = formData.get("referenceLine");
  const addressLine1 = formData.get("addressLine1");
  const cityStateZip = formData.get("cityStateZip");
  const defaultGlCode = formData.get("defaultGlCode");

  if (typeof vendorAccountCode !== "string" || !vendorAccountCode.trim()) {
    return { error: "Account code is required." };
  }
  if (typeof displayName !== "string" || !displayName.trim()) {
    return { error: "Vendor name is required." };
  }

  const [existing] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.vendorAccountCode, vendorAccountCode.trim()));
  if (existing) {
    return { error: `A vendor with account code "${vendorAccountCode.trim()}" already exists.` };
  }

  const [vendor] = await db
    .insert(vendors)
    .values({
      vendorAccountCode: vendorAccountCode.trim(),
      displayName: displayName.trim(),
      referenceLine: typeof referenceLine === "string" && referenceLine.trim() ? referenceLine.trim() : null,
      addressLine1: typeof addressLine1 === "string" && addressLine1.trim() ? addressLine1.trim() : null,
      cityStateZip: typeof cityStateZip === "string" && cityStateZip.trim() ? cityStateZip.trim() : null,
      defaultGlCode: typeof defaultGlCode === "string" && defaultGlCode.trim() ? defaultGlCode.trim() : null,
    })
    .returning();

  redirect(`/vendors/${vendor.id}`);
}
