import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts, contractParties } from "@/db/schema/contracts";
import { parties, properties } from "@/db/schema/parties";
import { payments, paymentAllocations } from "@/db/schema/payments";
import { trustLedgerEntries, escrowVouchers, escrowAnalyses } from "@/db/schema/escrow";
import { contractNotes } from "@/db/schema/notes";
import { vendorDisbursements } from "@/db/schema/vendors";
import { contractCharges } from "@/db/schema/charges";
import { postedBorrowerDocuments } from "@/db/schema/postedBorrowerDocuments";
import { checkLineItems } from "@/db/schema/checks";
import { lenderLedgerEntries } from "@/db/schema/lending";
import { noticeSends } from "@/db/schema/notices";
import { generatedDocuments } from "@/db/schema/documents";
import { contractOnboardingDrafts } from "@/db/schema/contractOnboardingDrafts";
import { amortizationScheduleVersions, scheduledPayments } from "@/db/schema/amortization";

export async function contractHasPayments(contractId: string): Promise<boolean> {
  const [row] = await db.select({ id: payments.id }).from(payments).where(eq(payments.contractId, contractId)).limit(1);
  return row !== undefined;
}

export async function cancelContract(contractId: string): Promise<void> {
  await db.update(contracts).set({ status: "CANCELLED", statusChangedAt: new Date() }).where(eq(contracts.id, contractId));
}

// Permanent, irreversible — only ever called after contractHasPayments() has
// confirmed zero payments, so this is effectively cleaning up a test/mistake
// entry, not real financial history. Deletes every row this contract owns
// outright; for parties/property that could plausibly be shared with OTHER
// contracts (a lender funding multiple loans, a re-listed property), only
// removes them if nothing else still references them afterward. Records
// that belong to a DIFFERENT entity's own history (a printed check, a
// lender's ledger, a sent notice) are unlinked (contractId set null) rather
// than deleted, since that history is real regardless of this contract's fate.
export async function deleteContractHard(contractId: string): Promise<void> {
  const hasPayments = await contractHasPayments(contractId);
  if (hasPayments) {
    throw new Error("This contract has recorded payments and can't be permanently deleted — cancel it instead.");
  }

  await db.transaction(async (tx) => {
    const [contract] = await tx.select({ propertyId: contracts.propertyId }).from(contracts).where(eq(contracts.id, contractId));
    if (!contract) return;

    const partyRows = await tx.select({ partyId: contractParties.partyId }).from(contractParties).where(eq(contractParties.contractId, contractId));

    // Unlink — this history belongs to a different entity and must persist
    // regardless of what happens to this contract.
    await tx.update(checkLineItems).set({ contractId: null }).where(eq(checkLineItems.contractId, contractId));
    await tx.update(lenderLedgerEntries).set({ sourceContractId: null }).where(eq(lenderLedgerEntries.sourceContractId, contractId));
    await tx.update(noticeSends).set({ contractId: null }).where(eq(noticeSends.contractId, contractId));
    await tx.update(generatedDocuments).set({ contractId: null }).where(eq(generatedDocuments.contractId, contractId));
    // Reverts the draft to editable/resumable rather than leaving it stuck
    // "published" and pointing at a contract that no longer exists.
    await tx
      .update(contractOnboardingDrafts)
      .set({ status: "DRAFT", publishedContractId: null, publishedAt: null })
      .where(eq(contractOnboardingDrafts.publishedContractId, contractId));

    // Owned outright — delete.
    const scheduleVersions = await tx
      .select({ id: amortizationScheduleVersions.id })
      .from(amortizationScheduleVersions)
      .where(eq(amortizationScheduleVersions.contractId, contractId));
    for (const v of scheduleVersions) {
      await tx.delete(scheduledPayments).where(eq(scheduledPayments.scheduleVersionId, v.id));
    }
    await tx.delete(amortizationScheduleVersions).where(eq(amortizationScheduleVersions.contractId, contractId));

    const paymentRows = await tx.select({ id: payments.id }).from(payments).where(eq(payments.contractId, contractId));
    for (const p of paymentRows) {
      await tx.delete(paymentAllocations).where(eq(paymentAllocations.paymentId, p.id));
    }
    await tx.delete(payments).where(eq(payments.contractId, contractId));

    await tx.delete(trustLedgerEntries).where(eq(trustLedgerEntries.contractId, contractId));
    await tx.delete(escrowVouchers).where(eq(escrowVouchers.contractId, contractId));
    await tx.delete(escrowAnalyses).where(eq(escrowAnalyses.contractId, contractId));
    await tx.delete(contractNotes).where(eq(contractNotes.contractId, contractId));
    await tx.delete(vendorDisbursements).where(eq(vendorDisbursements.contractId, contractId));
    await tx.delete(contractCharges).where(eq(contractCharges.contractId, contractId));
    await tx.delete(postedBorrowerDocuments).where(eq(postedBorrowerDocuments.contractId, contractId));

    await tx.delete(contractParties).where(eq(contractParties.contractId, contractId));
    await tx.delete(contracts).where(eq(contracts.id, contractId));

    // Only remove parties/property if nothing else still needs them.
    for (const { partyId } of partyRows) {
      const [stillUsed] = await tx.select({ id: contractParties.id }).from(contractParties).where(eq(contractParties.partyId, partyId)).limit(1);
      if (!stillUsed) {
        await tx.delete(parties).where(eq(parties.id, partyId));
      }
    }
    const [propertyStillUsed] = await tx
      .select({ id: contracts.id })
      .from(contracts)
      .where(eq(contracts.propertyId, contract.propertyId))
      .limit(1);
    if (!propertyStillUsed) {
      await tx.delete(properties).where(eq(properties.id, contract.propertyId));
    }
  });
}
