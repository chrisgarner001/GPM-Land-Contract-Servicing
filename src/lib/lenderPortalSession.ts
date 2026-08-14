import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "lender_portal_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const secret = process.env.LENDER_PORTAL_SESSION_SECRET;
  if (!secret) throw new Error("LENDER_PORTAL_SESSION_SECRET is not set.");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

// A single login (email + PIN) can legitimately resolve to many distinct
// lender entities — confirmed against real data: one analyst's credentials
// manage 25+ separate investor LLCs. The session holds every party ID that
// login was entitled to, and the page lets them pick which entity to view.
export async function createLenderPortalSession(partyIds: string[]): Promise<void> {
  const payload = JSON.stringify(partyIds);
  const value = `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
  const store = await cookies();
  store.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/online-portals/lenders",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getLenderPortalSession(): Promise<string[] | null> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (!value) return null;

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) return null;

  const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const partyIds = JSON.parse(payload);
    return Array.isArray(partyIds) && partyIds.every((id) => typeof id === "string") ? partyIds : null;
  } catch {
    return null;
  }
}

export async function clearLenderPortalSession(): Promise<void> {
  const store = await cookies();
  store.delete({ name: COOKIE_NAME, path: "/online-portals/lenders" });
}
