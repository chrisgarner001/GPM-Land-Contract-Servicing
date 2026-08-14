import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { payments } from "@/db/schema/payments";
import { getHelcimTransaction, verifyHelcimWebhookSignature } from "@/lib/helcim";
import { recordPayment, recordPrincipalPaydown, getUnpaidChargesCents } from "@/server/payments";

// The only API Route Handler in this app — everything else is Server
// Actions, but a webhook is inbound server-to-server HTTP that no browser
// session/action can receive. Helcim's webhook payload is just { id, type };
// it must never be trusted on its own, so this always calls back into
// Helcim's API for the authoritative transaction (see src/lib/helcim.ts).
//
// Deliberately NOT named .../webhooks/helcim — Helcim's own webhook-URL
// validation rejects a delivery URL containing the word "Helcim" (confirmed
// live: their dashboard's Save button 400'd against that exact path).
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const id = request.headers.get("webhook-id");
  const timestamp = request.headers.get("webhook-timestamp");
  const signatureHeader = request.headers.get("webhook-signature");
  if (!id || !timestamp || !signatureHeader) {
    return NextResponse.json({ error: "Missing webhook signature headers." }, { status: 401 });
  }

  const valid = verifyHelcimWebhookSignature({ id, timestamp, signatureHeader, rawBody });
  if (!valid) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let body: { id?: string; type?: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 });
  }
  if (!body.id || !body.type) {
    return NextResponse.json({ error: "Missing transaction id/type." }, { status: 400 });
  }

  const transaction = await getHelcimTransaction(body.id, body.type);

  const [payment] = await db.select().from(payments).where(eq(payments.id, transaction.invoiceNumber));
  // No matching row, or already resolved by an earlier delivery of this same
  // webhook — either way, nothing left to do. Returning 200 (rather than an
  // error that would trigger a retry storm) is correct in both cases.
  if (!payment || payment.status !== "PENDING") {
    return NextResponse.json({ ok: true });
  }

  const status = transaction.status.toUpperCase();
  if (status.includes("APPROV") || status.includes("COMPLET") || status.includes("SETTLE") || status === "SUCCESS") {
    const isPrincipalPaydown = payment.legacyDescription?.startsWith("Principal Paydown") ?? false;

    if (isPrincipalPaydown) {
      try {
        await recordPrincipalPaydown({
          contractId: payment.contractId,
          receivedDate: payment.receivedDate,
          amountCents: payment.amountCents,
          paymentMethod: transaction.method,
          referenceNumber: body.id,
          actorEmail: null,
          existingPaymentId: payment.id,
        });
      } catch {
        // Eligibility (e.g. no outstanding charges, not past due) could have
        // changed between initiation and settlement — real funds already
        // moved by this point, so they still must be applied, just via the
        // regular allocation instead of pure principal.
        await recordPayment({
          contractId: payment.contractId,
          receivedDate: payment.receivedDate,
          amountCents: payment.amountCents,
          paymentMethod: transaction.method,
          referenceNumber: body.id,
          actorEmail: null,
          existingPaymentId: payment.id,
        });
      }
    } else {
      const unpaidChargesCents = await getUnpaidChargesCents(payment.contractId);
      await recordPayment({
        contractId: payment.contractId,
        receivedDate: payment.receivedDate,
        amountCents: payment.amountCents,
        paymentMethod: transaction.method,
        referenceNumber: body.id,
        actorEmail: null,
        existingPaymentId: payment.id,
        chargePaymentCents: unpaidChargesCents,
      });
    }
  } else if (status.includes("RETURN") || status.includes("NSF")) {
    await db.update(payments).set({ status: "NSF", paymentMethod: transaction.method, externalPlatformRef: body.id }).where(eq(payments.id, payment.id));
  } else if (status.includes("DECLIN") || status.includes("FAIL") || status.includes("ABORT")) {
    await db.update(payments).set({ status: "REVERSED", paymentMethod: transaction.method, externalPlatformRef: body.id }).where(eq(payments.id, payment.id));
  }
  // Any other/unrecognized status (e.g. still genuinely pending on Helcim's
  // side) is left as PENDING — a later webhook delivery will resolve it.

  return NextResponse.json({ ok: true });
}
