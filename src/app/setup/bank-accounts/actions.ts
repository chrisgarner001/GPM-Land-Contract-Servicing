"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { bankAccounts } from "@/db/schema/setup";
import { parties } from "@/db/schema/parties";
import { vendors } from "@/db/schema/vendors";
import { encryptPII, decryptPII } from "@/lib/encryption";

export interface AddBankAccountState {
  error?: string;
}

export async function addBankAccount(_prevState: AddBankAccountState | undefined, formData: FormData): Promise<AddBankAccountState> {
  const label = formData.get("label");
  const bankName = formData.get("bankName");
  const routingNumber = formData.get("routingNumber");
  const accountNumber = formData.get("accountNumber");
  const notes = formData.get("notes");

  if (typeof label !== "string" || !label.trim()) {
    return { error: "Label is required." };
  }

  await db.insert(bankAccounts).values({
    label: label.trim(),
    bankName: typeof bankName === "string" && bankName.trim() ? bankName.trim() : null,
    routingNumber: typeof routingNumber === "string" && routingNumber.trim() ? routingNumber.trim() : null,
    accountNumberEncrypted: typeof accountNumber === "string" && accountNumber.trim() ? encryptPII(accountNumber.trim()) : null,
    accountNumberLast4: typeof accountNumber === "string" && accountNumber.trim() ? accountNumber.trim().slice(-4) : null,
    notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
  });

  revalidatePath("/setup/bank-accounts");
  revalidatePath("/vendors");
  revalidatePath("/lenders");
  return {};
}

export async function revealBankAccountNumber(bankAccountId: string): Promise<string | null> {
  const [account] = await db.select({ accountNumberEncrypted: bankAccounts.accountNumberEncrypted }).from(bankAccounts).where(eq(bankAccounts.id, bankAccountId));
  if (!account?.accountNumberEncrypted) return null;
  return decryptPII(account.accountNumberEncrypted);
}

// Un-assigns any vendor/lender currently defaulting to this account before
// deleting it, rather than letting the FK constraint reject the delete —
// this is just clearing a reference pointer on a setup list, not touching
// any transactional/financial record.
export async function removeBankAccount(bankAccountId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(vendors).set({ defaultBankAccountId: null }).where(eq(vendors.defaultBankAccountId, bankAccountId));
    await tx.update(parties).set({ defaultBankAccountId: null }).where(eq(parties.defaultBankAccountId, bankAccountId));
    await tx.delete(bankAccounts).where(eq(bankAccounts.id, bankAccountId));
  });

  revalidatePath("/setup/bank-accounts");
  revalidatePath("/vendors");
  revalidatePath("/lenders");
}
