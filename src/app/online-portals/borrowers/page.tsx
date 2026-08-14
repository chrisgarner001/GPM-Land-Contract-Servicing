import { eq, and, inArray, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts, contractParties } from "@/db/schema/contracts";
import { parties, properties } from "@/db/schema/parties";
import { payments } from "@/db/schema/payments";
import { formatCents, formatDate } from "@/lib/format";
import { getBorrowerPortalSession } from "@/lib/borrowerPortalSession";
import { calculateAmountDue, daysPastDue } from "@/domain/ledger/calculateAmountDue";
import { getUnpaidChargesCents, getCurrentEscrowPortionCents, checkPrincipalPaydownEligibility } from "@/server/payments";
import { postedBorrowerDocuments } from "@/db/schema/postedBorrowerDocuments";
import PortalHeader from "../_components/PortalHeader";
import LogoutButton from "./_components/LogoutButton";
import MakePaymentModal from "./_components/MakePaymentModal";
import PostedDocumentsSection from "../../_components/PostedDocumentsSection";

const DOCUMENT_LABELS: Record<string, string> = {
  STATEMENT_OF_ACCOUNT: "Statement of Account",
  OUTSTANDING_CHARGES: "Outstanding Charges",
  PAYOFF_LETTER: "Payoff Letter",
};

async function getBorrowerPortalData(contractId: string) {
  const [contract] = await db
    .select({
      contractNumber: contracts.contractNumber,
      status: contracts.status,
      borrowerPortalDeactivated: contracts.borrowerPortalDeactivated,
      currentPrincipalBalanceCents: contracts.currentPrincipalBalanceCents,
      nextPaymentDate: contracts.nextPaymentDate,
      paymentAmountCents: contracts.paymentAmountCents,
      paymentFrequency: contracts.paymentFrequency,
      lateFeeGraceDays: contracts.lateFeeGraceDays,
      lateFeeType: contracts.lateFeeType,
      lateFeeAmountCents: contracts.lateFeeAmountCents,
      lateFeePercent: contracts.lateFeePercent,
      streetAddress: properties.streetAddress,
      city: properties.city,
      state: properties.state,
    })
    .from(contracts)
    .leftJoin(properties, eq(contracts.propertyId, properties.id))
    .where(eq(contracts.id, contractId));
  // Re-checked on every page load, not just at Log In As time — a contract
  // deactivated after a session cookie was issued must lock out
  // immediately, same as the lender portal.
  if (!contract || contract.borrowerPortalDeactivated) return null;

  const buyers = await db
    .select({ displayName: parties.displayName })
    .from(contractParties)
    .innerJoin(parties, eq(contractParties.partyId, parties.id))
    .where(and(eq(contractParties.contractId, contractId), inArray(contractParties.role, ["BUYER", "CO_BUYER"])));

  const paymentHistory = await db
    .select({
      id: payments.id,
      receivedDate: payments.receivedDate,
      paymentMethod: payments.paymentMethod,
      amountCents: payments.amountCents,
      status: payments.status,
    })
    .from(payments)
    .where(eq(payments.contractId, contractId))
    .orderBy(desc(payments.receivedDate))
    .limit(50);

  const pastDue = daysPastDue(contract.nextPaymentDate);
  const amountDue = calculateAmountDue({
    paymentAmountCents: contract.paymentAmountCents,
    daysPastDue: pastDue,
    lateFeeGraceDays: contract.lateFeeGraceDays,
    lateFeeType: contract.lateFeeType,
    lateFeeAmountCents: contract.lateFeeAmountCents,
    lateFeePercent: contract.lateFeePercent,
  });
  const escrowPortionCents = await getCurrentEscrowPortionCents(contractId);
  const unpaidChargesCents = await getUnpaidChargesCents(contractId);
  const totalDueCents = contract.paymentAmountCents + escrowPortionCents + amountDue.lateFeeCents;
  const principalPaydownEligibility = await checkPrincipalPaydownEligibility(contractId);

  const postedDocuments = await db
    .select()
    .from(postedBorrowerDocuments)
    .where(eq(postedBorrowerDocuments.contractId, contractId))
    .orderBy(desc(postedBorrowerDocuments.postedAt));

  return {
    contract,
    buyers,
    paymentHistory,
    postedDocuments,
    breakdown: {
      paymentAmountCents: contract.paymentAmountCents,
      lateFeeCents: amountDue.lateFeeCents,
      escrowPortionCents,
      unpaidChargesCents,
      totalDueCents,
    },
    principalPaydownEligibility,
  };
}

export default async function BorrowerPortalPage() {
  const contractId = await getBorrowerPortalSession();

  if (!contractId) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <PortalHeader />
        <p className="text-sm text-slate-500">You&apos;re not signed in.</p>
      </main>
    );
  }

  const data = await getBorrowerPortalData(contractId);
  if (!data) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <PortalHeader />
        <p className="text-sm text-slate-500">You&apos;re not signed in.</p>
      </main>
    );
  }

  const { contract, buyers, paymentHistory, postedDocuments, breakdown, principalPaydownEligibility } = data;
  const buyerNames = buyers.map((b) => b.displayName).join(", ") || "—";
  const propertyAddress = contract.streetAddress
    ? `${contract.streetAddress}, ${contract.city}, ${contract.state}`
    : "—";

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <PortalHeader />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Contract {contract.contractNumber}</h1>
          <p className="text-sm text-slate-500">{propertyAddress}</p>
          <p className="text-sm text-slate-500">{buyerNames}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MakePaymentModal
            currentBalanceCents={contract.currentPrincipalBalanceCents}
            breakdown={breakdown}
            principalPaydownEligibility={principalPaydownEligibility}
          />
          <LogoutButton />
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</div>
          <div className="mt-1 text-sm font-medium text-slate-900">{contract.status}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Principal Balance</div>
          <div className="mt-1 text-sm font-medium text-slate-900">{formatCents(contract.currentPrincipalBalanceCents)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Next Payment Date</div>
          <div className="mt-1 text-sm font-medium text-slate-900">{formatDate(contract.nextPaymentDate)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Payment Amount</div>
          <div className="mt-1 text-sm font-medium text-slate-900">
            {formatCents(contract.paymentAmountCents)} ({contract.paymentFrequency})
          </div>
        </div>
      </div>

      <PostedDocumentsSection documents={postedDocuments} labels={DOCUMENT_LABELS} />

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Payment History</h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Received Date</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paymentHistory.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  No payments on file.
                </td>
              </tr>
            ) : (
              paymentHistory.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-slate-600">{formatDate(p.receivedDate)}</td>
                  <td className="px-4 py-3 text-slate-500">{p.paymentMethod}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">{formatCents(p.amountCents)}</td>
                  <td className="px-4 py-3 text-slate-500">{p.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
