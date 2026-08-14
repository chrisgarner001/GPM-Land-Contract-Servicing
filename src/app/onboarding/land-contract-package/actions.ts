"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireEditAccess } from "@/lib/staffRole";
import { createLandContractPackage } from "@/server/landContractPackages";

export async function createPackageAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await requireEditAccess(user?.email);

  const id = await createLandContractPackage(user?.email ?? null);
  redirect(`/onboarding/land-contract-package/${id}`);
}
