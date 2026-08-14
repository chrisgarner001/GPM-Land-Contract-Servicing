"use server";

import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db/client";
import { parties } from "@/db/schema/parties";
import { contractParties } from "@/db/schema/contracts";
import { createLenderPortalSession } from "@/lib/lenderPortalSession";
import { createClient } from "@/lib/supabase/server";
import { requireEditAccess } from "@/lib/staffRole";

export interface LogInAsLenderState {
  error?: string;
}

// Staff-only impersonation: skips the lender's own PIN since staff are
// already authenticated via the main app's Supabase session. Resolves every
// entity that shares this lender's email+PIN — the same login an analyst
// managing multiple investor LLCs would use — so the preview matches what
// that real login sees (portfolio picker included), landing on the specific
// entity staff clicked rather than hiding its siblings.
//
// Blocked entirely if this lender's portal access has been deactivated —
// staff previewing a deactivated account would be misleading (it should
// behave exactly as if login were impossible, matching what a real login
// attempt would see).
// Opens in a new browser window (see LogInAsNewWindowButton) rather than
// redirecting the staff member's own tab, so staff can see exactly what the
// lender sees side-by-side with the admin view they were just on.
export async function logInAsLenderAction(lenderId: string): Promise<LogInAsLenderState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  const [lender] = await db
    .select({ email: parties.email, portalPin: parties.portalPin, portalDeactivated: parties.portalDeactivated })
    .from(parties)
    .where(eq(parties.id, lenderId));

  if (lender?.portalDeactivated) {
    return { error: "This lender's portal access has been deactivated." };
  }

  let partyIds = [lenderId];
  if (lender?.email && lender.portalPin) {
    const matches = await db
      .selectDistinct({ id: parties.id })
      .from(parties)
      .innerJoin(
        contractParties,
        and(eq(contractParties.partyId, parties.id), eq(contractParties.role, "INVESTOR_PAYEE"), gt(contractParties.ownershipPercent, "0"))
      )
      .where(and(eq(parties.email, lender.email), eq(parties.portalPin, lender.portalPin), eq(parties.portalDeactivated, false)));
    if (matches.length > 0) partyIds = matches.map((m) => m.id);
  }

  await createLenderPortalSession(partyIds);
  return {};
}
