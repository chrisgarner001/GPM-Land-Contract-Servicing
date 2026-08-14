"use server";

import { revalidatePath } from "next/cache";
import { eq, and, gt, ilike, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { parties } from "@/db/schema/parties";
import { contractParties } from "@/db/schema/contracts";
import { createLenderPortalSession, clearLenderPortalSession } from "@/lib/lenderPortalSession";

export interface LenderLoginState {
  error?: string;
}

export async function lenderLoginAction(
  _prevState: LenderLoginState | undefined,
  formData: FormData
): Promise<LenderLoginState> {
  const email = formData.get("email");
  const pin = formData.get("pin");

  if (typeof email !== "string" || !email.trim() || typeof pin !== "string" || !pin.trim()) {
    return { error: "Enter your email and portal PIN." };
  }

  // One login can legitimately be entitled to many distinct lender entities
  // (an analyst managing several investor LLCs, all sharing one email/PIN) —
  // this finds every one of them, not just the first row Postgres returns.
  const matches = await db
    .selectDistinct({ id: parties.id, portalDeactivated: parties.portalDeactivated })
    .from(parties)
    .innerJoin(
      contractParties,
      and(eq(contractParties.partyId, parties.id), eq(contractParties.role, "INVESTOR_PAYEE"), gt(contractParties.ownershipPercent, "0"))
    )
    .where(and(ilike(parties.email, email.trim()), eq(parties.portalPin, pin.trim())));

  if (matches.length === 0) {
    return { error: "Email or PIN not recognized." };
  }

  // A deactivated entity is excluded from the session entirely — if that
  // was the only match, this login is fully blocked rather than silently
  // succeeding into an empty portfolio.
  const activeMatches = matches.filter((m) => !m.portalDeactivated);
  if (activeMatches.length === 0) {
    return { error: "This account's portal access has been deactivated." };
  }

  const partyIds = activeMatches.map((m) => m.id);
  await createLenderPortalSession(partyIds);
  // Only a genuine self-service login updates this — staff's own Log In As
  // impersonation never does (see logInAsLenderAction).
  await db.update(parties).set({ portalLastLoginAt: new Date() }).where(inArray(parties.id, partyIds));
  revalidatePath("/online-portals/lenders");
  return {};
}

export async function lenderLogoutAction(): Promise<void> {
  await clearLenderPortalSession();
  revalidatePath("/online-portals/lenders");
}
