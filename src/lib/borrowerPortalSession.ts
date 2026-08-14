import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "borrower_portal_session";
const MAX_AGE_SECONDS = 60 * 30; // 30 minutes — staff impersonation preview, not a remembered login

function getSecret(): string {
  const secret = process.env.BORROWER_PORTAL_SESSION_SECRET;
  if (!secret) throw new Error("BORROWER_PORTAL_SESSION_SECRET is not set.");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

// A borrower portal PIN is keyed by loan account, not by person — co-buyers on
// the same contract share one login. So unlike the lender session, this
// payload is a single contractId, not an array.
export async function createBorrowerPortalSession(contractId: string): Promise<void> {
  const value = `${Buffer.from(contractId).toString("base64url")}.${sign(contractId)}`;
  const store = await cookies();
  store.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/online-portals/borrowers",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getBorrowerPortalSession(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (!value) return null;

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) return null;

  const contractId = Buffer.from(encodedPayload, "base64url").toString("utf8");
  const expected = sign(contractId);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return contractId;
}

export async function clearBorrowerPortalSession(): Promise<void> {
  const store = await cookies();
  store.delete({ name: COOKIE_NAME, path: "/online-portals/borrowers" });
}
