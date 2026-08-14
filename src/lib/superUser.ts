import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { staffUsers } from "@/db/schema/setup";

// The first REAL enforcement of staff_users.role in this app — until now it
// was purely informational (see the schema comment). Gates the Program
// Customization agent only; every other page still relies solely on the
// staff Supabase-session gate in src/proxy.ts.
export async function isSuperUser(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const [row] = await db.select({ role: staffUsers.role }).from(staffUsers).where(eq(staffUsers.email, email));
  return row?.role === "ADMIN";
}
