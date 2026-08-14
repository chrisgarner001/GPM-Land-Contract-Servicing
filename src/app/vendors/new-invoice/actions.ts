"use server";

import { revalidatePath } from "next/cache";
import { createVendor, createVendorInvoice } from "@/server/vendorInvoices";
import { paymentMethodEnum } from "@/db/schema/payments";
import { createClient } from "@/lib/supabase/server";
import { requireEditAccess } from "@/lib/staffRole";

export interface CreateInvoiceState {
  error?: string;
  success?: string;
}

export async function createInvoiceAction(
  _prevState: CreateInvoiceState | undefined,
  formData: FormData
): Promise<CreateInvoiceState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  const vendorMode = formData.get("vendorMode");
  const contractId = formData.get("contractId");
  const amountDollars = formData.get("amount");
  const dueDate = formData.get("dueDate");
  const reference = formData.get("reference");
  const glCode = formData.get("glCode");
  const applyMode = formData.get("applyMode") === "CHARGE_LENDER" ? "CHARGE_LENDER" : "ESCROW";
  const paymentMethodRaw = formData.get("paymentMethod");
  const paymentMethod = paymentMethodEnum.enumValues.includes(paymentMethodRaw as (typeof paymentMethodEnum.enumValues)[number])
    ? (paymentMethodRaw as (typeof paymentMethodEnum.enumValues)[number])
    : null;

  if (typeof contractId !== "string" || !contractId) {
    return { error: "Select a land contract." };
  }
  const amountCents = Math.round(Number(amountDollars) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { error: "Enter a valid amount." };
  }
  if (typeof dueDate !== "string" || !dueDate) {
    return { error: "Due date is required." };
  }
  if (typeof glCode !== "string" || !glCode.trim()) {
    return { error: "Select a GL code." };
  }

  let vendorId: string;
  if (vendorMode === "new") {
    const newDisplayName = formData.get("newVendorName");
    if (typeof newDisplayName !== "string" || !newDisplayName.trim()) {
      return { error: "Enter a name for the new vendor." };
    }
    vendorId = await createVendor(newDisplayName.trim());
  } else {
    const existingVendorId = formData.get("existingVendorId");
    if (typeof existingVendorId !== "string" || !existingVendorId) {
      return { error: "Select a vendor." };
    }
    vendorId = existingVendorId;
  }

  try {
    await createVendorInvoice({
      vendorId,
      contractId,
      amountCents,
      dueDate,
      reference: typeof reference === "string" && reference.trim() ? reference.trim() : null,
      glCode: typeof glCode === "string" && glCode.trim() ? glCode.trim() : null,
      paymentMethod,
      applyMode,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create invoice." };
  }

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath(`/contracts/${contractId}/escrow-analysis`);
  revalidatePath(`/contracts/${contractId}/trust-ledger`);
  revalidatePath("/escrow-maintenance");
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath("/lenders");

  return {
    success:
      applyMode === "CHARGE_LENDER"
        ? "Invoice recorded, charged to the borrower's contract, and debited from the lender's ledger."
        : "Invoice recorded and applied to the contract's escrow balance.",
  };
}
