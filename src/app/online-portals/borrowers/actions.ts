"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { contracts } from "@/db/schema/contracts";
import { payments } from "@/db/schema/payments";
import { clearBorrowerPortalSession, getBorrowerPortalSession } from "@/lib/borrowerPortalSession";
import { initializeHelcimCheckout } from "@/lib/helcim";
import { checkPrincipalPaydownEligibility } from "@/server/payments";

export async function borrowerLogoutAction(): Promise<void> {
  await clearBorrowerPortalSession();
  revalidatePath("/online-portals/borrowers");
}

export interface InitiateBorrowerPaymentResult {
  checkoutToken: string;
  paymentId: string;
}

// Inserts a PENDING payments row up front (before Helcim ever has an
// invoiceNumber to hand back to us), then initializes the HelcimPay.js
// checkout session against it. The Helcim webhook (src/app/api/webhooks/payments)
// is the only thing that ever flips this row to CLEARED/NSF/REVERSED and
// applies real loan-balance/lender-ledger effects — nothing here does.
export async function initiateBorrowerPaymentAction(amountCents: number): Promise<InitiateBorrowerPaymentResult> {
  const contractId = await getBorrowerPortalSession();
  if (!contractId) throw new Error("You're not signed in.");

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Enter an amount greater than zero.");
  }

  const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!contract || contract.borrowerPortalDeactivated) throw new Error("You're not signed in.");
  if (contract.status !== "ACTIVE") throw new Error("This contract is not active — online payments aren't available.");

  const [payment] = await db
    .insert(payments)
    .values({
      contractId,
      receivedDate: new Date().toISOString().slice(0, 10),
      amountCents,
      paymentMethod: "PAID_ONLINE",
      status: "PENDING",
      legacyDescription: "Submitted via borrower portal (Helcim) — awaiting confirmation",
    })
    .returning();

  const { checkoutToken } = await initializeHelcimCheckout({ amountCents, invoiceNumber: payment.id });

  revalidatePath("/online-portals/borrowers");
  return { checkoutToken, paymentId: payment.id };
}

// Mirrors initiateBorrowerPaymentAction, but marks the PENDING row so the
// webhook applies it via recordPrincipalPaydown (100% to principal) instead
// of the regular escrow/late-fee/interest/principal allocation — see
// src/app/api/webhooks/payments/route.ts. Eligibility is re-checked here
// server-side regardless of what the client showed, since this moves money.
export async function initiateBorrowerPrincipalPaydownAction(amountCents: number): Promise<InitiateBorrowerPaymentResult> {
  const contractId = await getBorrowerPortalSession();
  if (!contractId) throw new Error("You're not signed in.");

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Enter an amount greater than zero.");
  }

  const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!contract || contract.borrowerPortalDeactivated) throw new Error("You're not signed in.");
  if (contract.status !== "ACTIVE") throw new Error("This contract is not active — online payments aren't available.");

  const eligibility = await checkPrincipalPaydownEligibility(contractId);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason ?? "Principal Paydown is not allowed on this contract right now.");
  }
  if (amountCents > contract.currentPrincipalBalanceCents) {
    throw new Error("Amount exceeds the outstanding principal balance.");
  }

  const [payment] = await db
    .insert(payments)
    .values({
      contractId,
      receivedDate: new Date().toISOString().slice(0, 10),
      amountCents,
      paymentMethod: "PAID_ONLINE",
      status: "PENDING",
      legacyDescription: "Principal Paydown via borrower portal (Helcim) — awaiting confirmation",
    })
    .returning();

  const { checkoutToken } = await initializeHelcimCheckout({ amountCents, invoiceNumber: payment.id });

  revalidatePath("/online-portals/borrowers");
  return { checkoutToken, paymentId: payment.id };
}
