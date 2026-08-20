"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireEditAccess } from "@/lib/staffRole";
import { createLandContractPackage, deleteLandContractPackage, getLandContractPackage } from "@/server/landContractPackages";

export async function createPackageAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await requireEditAccess(user?.email);

  const id = await createLandContractPackage(user?.email ?? null);
  redirect(`/onboarding/land-contract-package/${id}`);
}

export interface DeletePackageState {
  error?: string;
}

// Only for a still-DRAFT package — a PUBLISHED one already generated real
// closing documents into Google Drive and must be handled by hand there.
export async function deletePackageAction(
  packageId: string,
  _prevState: DeletePackageState | undefined
): Promise<DeletePackageState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  const pkg = await getLandContractPackage(packageId);
  if (!pkg) return { error: "Package not found." };
  if (pkg.status === "PUBLISHED") {
    return { error: "This package has already been published to Google Drive and can't be deleted from here." };
  }

  await deleteLandContractPackage(packageId);
  revalidatePath("/onboarding/land-contract-package");
  return {};
}
