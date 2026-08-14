"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createLandContractPackage } from "@/server/landContractPackages";

export async function createPackageAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const id = await createLandContractPackage(user?.email ?? null);
  redirect(`/onboarding/land-contract-package/${id}`);
}
