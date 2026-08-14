import { createHmac, timingSafeEqual } from "crypto";

const API_BASE = "https://api.helcim.com/v2";

function getApiToken(): string {
  const token = process.env.HELCIM_API_TOKEN;
  if (!token) throw new Error("HELCIM_API_TOKEN is not set.");
  return token;
}

export interface InitializeHelcimCheckoutInput {
  amountCents: number;
  invoiceNumber: string;
}

export interface InitializeHelcimCheckoutResult {
  checkoutToken: string;
}

// Borrower portal "Make Payment" only — allows both card and ACH in one
// modal (paymentMethod: "cc-ach"), with Helcim's own convenience-fee
// surcharge applied automatically to card only (hasConvenienceFee). amount
// is the amount applied to the loan; the surcharge (if any) is added by
// Helcim on top and is never reflected in our own payments.amountCents.
export async function initializeHelcimCheckout(input: InitializeHelcimCheckoutInput): Promise<InitializeHelcimCheckoutResult> {
  const res = await fetch(`${API_BASE}/helcim-pay/initialize`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-token": getApiToken(),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      paymentType: "purchase",
      amount: input.amountCents / 100,
      currency: "USD",
      paymentMethod: "cc-ach",
      hasConvenienceFee: 1,
      invoiceNumber: input.invoiceNumber,
      confirmationScreen: true,
    }),
  });
  if (!res.ok) {
    throw new Error(`Helcim checkout initialize failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { checkoutToken: string };
  return { checkoutToken: data.checkoutToken };
}

export interface HelcimTransaction {
  invoiceNumber: string;
  status: string;
  method: "CARD" | "ACH";
}

// The webhook payload only carries { id, type } — this fetches the
// authoritative transaction record (status, invoiceNumber) by id, since the
// webhook body itself must never be trusted as proof of a completed payment.
export async function getHelcimTransaction(id: string, type: string): Promise<HelcimTransaction> {
  const isAch = type.toLowerCase().includes("ach") || type.toLowerCase().includes("bank");
  const path = isAch ? `bank-transactions/${id}` : `card-transactions/${id}`;
  const res = await fetch(`${API_BASE}/${path}`, {
    headers: { accept: "application/json", "api-token": getApiToken() },
  });
  if (!res.ok) {
    throw new Error(`Helcim transaction lookup failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { invoiceNumber: string; status: string };
  return { invoiceNumber: data.invoiceNumber, status: data.status, method: isAch ? "ACH" : "CARD" };
}

export interface VerifyHelcimWebhookSignatureInput {
  id: string;
  timestamp: string;
  // The raw "webhook-signature" header value — a space-delimited list of
  // "{version},{base64signature}" entries (Svix's standard webhook format;
  // Helcim webhooks are built on Svix). Usually just one entry, but the spec
  // allows more, so every "v1,..." entry must be checked.
  signatureHeader: string;
  rawBody: string;
}

// HMAC-SHA256 over "{id}.{timestamp}.{rawBody}", keyed by the base64-decoded
// verifierToken from the Helcim dashboard's webhook settings — see
// https://devdocs.helcim.com/docs/webhooks.
export function verifyHelcimWebhookSignature(input: VerifyHelcimWebhookSignatureInput): boolean {
  const verifierToken = process.env.HELCIM_WEBHOOK_VERIFIER_TOKEN;
  if (!verifierToken) throw new Error("HELCIM_WEBHOOK_VERIFIER_TOKEN is not set.");

  const signedContent = `${input.id}.${input.timestamp}.${input.rawBody}`;
  const key = Buffer.from(verifierToken, "base64");
  const expected = Buffer.from(createHmac("sha256", key).update(signedContent).digest("base64"));

  return input.signatureHeader
    .split(" ")
    .filter(Boolean)
    .some((entry) => {
      const [version, signature] = entry.split(",");
      if (version !== "v1" || !signature) return false;
      const candidate = Buffer.from(signature);
      return candidate.length === expected.length && timingSafeEqual(candidate, expected);
    });
}
