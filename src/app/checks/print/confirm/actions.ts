"use server";

import { redirect } from "next/navigation";
import { markChecksPrinted } from "@/server/printChecks";

export async function confirmPrintedAction(formData: FormData): Promise<void> {
  const ids = (formData.get("ids") as string)?.split(",").filter(Boolean) ?? [];
  const returnTo = (formData.get("returnTo") as string) || "/";
  await markChecksPrinted(ids);
  redirect(returnTo);
}
