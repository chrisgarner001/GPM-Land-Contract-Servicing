import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { staffUsers, staffRoleEnum } from "@/db/schema/setup";

export type StaffRole = (typeof staffRoleEnum.enumValues)[number];

// No staff_users row for the email (e.g. an account created directly in the
// Supabase dashboard before ever being added here) defaults to OFFICE — the
// same access every logged-in account had before roles were enforced at all,
// so an existing account never gets silently locked out by this feature.
export async function getStaffRole(email: string | null | undefined): Promise<StaffRole> {
  if (!email) return "OFFICE";
  const [row] = await db.select({ role: staffUsers.role }).from(staffUsers).where(eq(staffUsers.email, email));
  return row?.role ?? "OFFICE";
}

// Every mutating Server Action should call this first, before touching the
// database or sending anything — throws for view-only USER accounts. Callers
// already fetching the current user's email for createdBy/updatedBy should
// pass it in directly rather than triggering a second auth round-trip.
export async function requireEditAccess(email: string | null | undefined): Promise<void> {
  const role = await getStaffRole(email);
  if (role === "USER") {
    throw new Error("Your account has view-only access and can't make changes.");
  }
}
