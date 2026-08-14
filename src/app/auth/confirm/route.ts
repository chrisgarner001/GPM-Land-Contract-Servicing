import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Verifies a Supabase email link (invite, password recovery, etc.)
// server-side and establishes the session via cookies before redirecting —
// Supabase's own recommended pattern, since the app's proxy only refreshes
// an already-established session and doesn't exchange a fresh link itself.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/contracts";

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/login?error=Invalid or expired link.`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
