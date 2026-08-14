import { createClient } from "@supabase/supabase-js";

// Server-only — uses the service_role key, which bypasses RLS and can
// administer auth users. NEVER import this from a Client Component or leak
// the key to the browser bundle. Used only for staff invite (Setup > Users).
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
