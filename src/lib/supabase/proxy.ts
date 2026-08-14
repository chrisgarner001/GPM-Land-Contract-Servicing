import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Lender Portal has its own email+PIN login (see lenderPortalSession.ts),
// entirely separate from staff Supabase auth — external lenders never get a
// staff account, so this whole subtree must bypass the staff gate.
//
// /api/webhooks is inbound server-to-server HTTP from third parties (e.g.
// Helcim) — it can never carry a staff Supabase session cookie, so it must
// bypass this gate too. Auth for those routes is handled inside the route
// itself (e.g. HMAC webhook signature verification), not here.
//
// /auth/confirm is what actually CREATES the session (invite/recovery link
// verification) — a visitor hitting it has no session yet by definition, so
// it can't sit behind the same gate it's establishing.
const PUBLIC_PATHS = ["/login", "/online-portals/lenders", "/api/webhooks", "/auth/confirm"];

export async function updateSession(request: NextRequest) {
  // Forwarded so the root layout (a Server Component, can't use usePathname())
  // can tell whether it's rendering an /online-portals/* preview and hide the
  // staff Sidebar/sign-out bar even though the viewing staff member still has
  // a real Supabase session.
  request.headers.set("x-pathname", request.nextUrl.pathname);

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // Required to keep the session cookie fresh — do not remove this call.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (user && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/contracts", request.url));
  }

  return response;
}
