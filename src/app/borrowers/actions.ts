"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts } from "@/db/schema/contracts";
import { createBorrowerPortalSession } from "@/lib/borrowerPortalSession";

export interface LogInAsBorrowerState {
  error?: string;
}

// Staff-only impersonation: a borrower portal PIN belongs to exactly one
// contract (unlike lenders, whose login can span many entities), so this
// just uses the contractId already selected on the Borrowers row.
//
// Blocked entirely if this contract's borrower portal has been deactivated
// — this is currently the ONLY way anyone "logs into" a borrower's portal
// (no self-service borrower login exists yet), so blocking it here is the
// full enforcement, not just half of it.
// Opens in a new browser window (see LogInAsNewWindowButton) rather than
// redirecting the staff member's own tab, so staff can see exactly what the
// borrower sees side-by-side with the admin view they were just on.
export async function logInAsBorrowerAction(contractId: string): Promise<LogInAsBorrowerState> {
  const [contract] = await db
    .select({ borrowerPortalDeactivated: contracts.borrowerPortalDeactivated })
    .from(contracts)
    .where(eq(contracts.id, contractId));

  if (contract?.borrowerPortalDeactivated) {
    return { error: "This borrower's portal access has been deactivated." };
  }

  await createBorrowerPortalSession(contractId);
  return {};
}
