"use server";

import { redirect } from "next/navigation";
import { markChecksPrinted } from "@/server/printChecks";
import { createClient } from "@/lib/supabase/server";
import { requireEditAccess } from "@/lib/staffRole";

export async function confirmPrintedAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await requireEditAccess(user?.email);

  const ids = (formData.get("ids") as string)?.split(",").filter(Boolean) ?? [];
  const returnTo = (formData.get("returnTo") as string) || "/";
  await markChecksPrinted(ids);
  redirect(returnTo);
}
