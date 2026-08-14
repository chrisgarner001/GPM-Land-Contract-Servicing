import { eq, and, gt, isNull } from "drizzle-orm";
import Decimal from "decimal.js";
import { db } from "@/db/client";
import { contractParties } from "@/db/schema/contracts";
import { parties } from "@/db/schema/parties";

export interface AddLenderFundingInput {
  contractId: string;
  lenderPartyId: string;
  fundedAmountCents: number;
  interestRateAnnual: string;
  fundingDate: string;
  // Defaults to "100" (fully replaces the current lender(s), as before). A
  // value below 100 instead scales down the existing active lender(s)
  // proportionally to make room, so multiple lenders can hold a genuine
  // simultaneous split.
  ownershipPercent: string;
  // Flat dollar amount deducted from this lender's share of each payment —
  // see contractParties.brokerServicingFeeCents. Null means "not set,"
  // matching how the carry-forward case below already leaves it.
  brokerServicingFeeCents: number | null;
}

// Confirmed with the business: adding a new funding entry at 100% supersedes
// the contract's current lender(s) going forward — it isn't just a
// historical note. The previously-active row(s) are closed out
// (ownershipPercent set to 0, endDate stamped) rather than deleted, so
// funding history stays visible, and every other page that reads "the
// current lender" already filters on ownershipPercent > 0 (Lenders list,
// Lender Portal, logInAsLenderAction), so closing out the old row is
// sufficient to redirect future payment distributions without touching those
// other call sites. A funding below 100% instead scales the existing active
// lender(s) down rather than closing them out — they keep funding the
// contract, just at a smaller share — which self-balances to <=100% total
// since each existing share is scaled by the same (1 - newPercent/100)
// factor.
export async function addLenderFunding(input: AddLenderFundingInput): Promise<void> {
  const { contractId, lenderPartyId, fundedAmountCents, interestRateAnnual, fundingDate, ownershipPercent, brokerServicingFeeCents } =
    input;

  const newPercent = new Decimal(ownershipPercent);
  if (!newPercent.isFinite() || newPercent.lte(0) || newPercent.gt(100)) {
    throw new Error("Ownership percent must be greater than 0 and no more than 100.");
  }

  await db.transaction(async (tx) => {
    const activeRows = await tx
      .select({
        id: contractParties.id,
        brokerServicingFeeCents: contractParties.brokerServicingFeeCents,
        ownershipPercent: contractParties.ownershipPercent,
      })
      .from(contractParties)
      .where(
        and(
          eq(contractParties.contractId, contractId),
          eq(contractParties.role, "INVESTOR_PAYEE"),
          gt(contractParties.ownershipPercent, "0"),
          isNull(contractParties.endDate)
        )
      );

    if (newPercent.eq(100)) {
      for (const row of activeRows) {
        await tx
          .update(contractParties)
          .set({ ownershipPercent: "0", endDate: fundingDate })
          .where(eq(contractParties.id, row.id));
      }
    } else {
      const scaleFactor = new Decimal(1).minus(newPercent.dividedBy(100));
      for (const row of activeRows) {
        const scaledPercent = new Decimal(row.ownershipPercent ?? "0").mul(scaleFactor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        await tx
          .update(contractParties)
          .set({ ownershipPercent: scaledPercent.toString() })
          .where(eq(contractParties.id, row.id));
      }
    }

    // An explicit fee from the caller (staff now sets this directly when
    // assigning funding) always wins. Only when it's left unset do we fall
    // back to carrying the prior fee forward, and only for a full 100%
    // funding with exactly one prior lender — with co-investors (or a
    // partial split) the fee split isn't well-defined from this action alone.
    const resolvedServicingFeeCents =
      brokerServicingFeeCents ?? (newPercent.eq(100) && activeRows.length === 1 ? activeRows[0].brokerServicingFeeCents : null);

    await tx.insert(contractParties).values({
      contractId,
      partyId: lenderPartyId,
      role: "INVESTOR_PAYEE",
      ownershipPercent: newPercent.toString(),
      brokerServicingFeeCents: resolvedServicingFeeCents,
      fundedAmountCents,
      interestRateAnnual,
      fundingDate,
      endDate: null,
    });
  });
}

export interface UpdateLenderFundingInput {
  contractPartyId: string;
  fundedAmountCents: number;
  interestRateAnnual: string;
  fundingDate: string;
  brokerServicingFeeCents: number | null;
}

// Corrects/backfills the funded amount, rate, and date on an EXISTING
// funding row in place — unlike addLenderFunding, this never closes out or
// creates a row, since it's not a change in who's funding the contract.
// Added because the historical TMO import never populated these three
// fields on any contract_parties row (confirmed: 0 of 710), so there was
// previously no way to enter them for a contract's current lender without
// it looking like a brand-new funding event happened today.
export async function updateLenderFunding(input: UpdateLenderFundingInput): Promise<void> {
  const { contractPartyId, fundedAmountCents, interestRateAnnual, fundingDate, brokerServicingFeeCents } = input;
  await db
    .update(contractParties)
    .set({ fundedAmountCents, interestRateAnnual, fundingDate, brokerServicingFeeCents })
    .where(eq(contractParties.id, contractPartyId));
}

export interface LenderOption {
  id: string;
  displayName: string;
}

export async function getExistingLenderOptions(): Promise<LenderOption[]> {
  return db
    .selectDistinct({ id: parties.id, displayName: parties.displayName })
    .from(parties)
    .innerJoin(contractParties, eq(contractParties.partyId, parties.id))
    .where(eq(contractParties.role, "INVESTOR_PAYEE"))
    .orderBy(parties.displayName);
}
