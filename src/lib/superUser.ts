import { getStaffRole } from "./staffRole";

// Gates the Program Customization agent only — every other page's access is
// governed by getStaffRole/requireEditAccess (src/lib/staffRole.ts) instead.
export async function isSuperUser(email: string | null | undefined): Promise<boolean> {
  return (await getStaffRole(email)) === "ADMIN";
}
