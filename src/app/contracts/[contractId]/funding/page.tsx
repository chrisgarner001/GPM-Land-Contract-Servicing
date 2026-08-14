import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { contractParties } from "@/db/schema/contracts";
import { parties } from "@/db/schema/parties";
import { getExistingLenderOptions } from "@/server/funding";
import { formatCents, formatDate, formatPercent } from "@/lib/format";
import AddLenderFundingModal from "./_components/AddLenderFundingModal";
import EditLenderFundingModal from "./_components/EditLenderFundingModal";

async function getFundingHistory(contractId: string) {
  return db
    .select({
      id: contractParties.id,
      partyId: parties.id,
      displayName: parties.displayName,
      ownershipPercent: contractParties.ownershipPercent,
      fundedAmountCents: contractParties.fundedAmountCents,
      interestRateAnnual: contractParties.interestRateAnnual,
      fundingDate: contractParties.fundingDate,
      endDate: contractParties.endDate,
    })
    .from(contractParties)
    .innerJoin(parties, eq(contractParties.partyId, parties.id))
    .where(and(eq(contractParties.contractId, contractId), eq(contractParties.role, "INVESTOR_PAYEE")))
    .orderBy(desc(contractParties.fundingDate), desc(contractParties.createdAt));
}

export default async function FundingPage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params;

  const [history, existingLenders] = await Promise.all([getFundingHistory(contractId), getExistingLenderOptions()]);

  const currentLenders = history.filter((h) => h.endDate === null && Number(h.ownershipPercent) > 0);
  const currentIds = new Set(currentLenders.map((h) => h.id));
  const past = history.filter((h) => !currentIds.has(h.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current Funding</h3>
        <AddLenderFundingModal contractId={contractId} existingLenders={existingLenders} />
      </div>

      {currentLenders.length === 0 ? (
        <p className="text-sm text-slate-400">No active lender funding on record for this contract.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Lender</th>
                <th className="px-3 py-2 text-right">Ownership</th>
                <th className="px-3 py-2">Funding Date</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right">Interest Rate</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentLenders.map((h) => (
                <tr key={h.id}>
                  <td className="px-3 py-2 font-medium text-slate-900">{h.displayName}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{formatPercent(h.ownershipPercent)}</td>
                  <td className="px-3 py-2 text-slate-600">{formatDate(h.fundingDate)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{formatCents(h.fundedAmountCents)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{formatPercent(h.interestRateAnnual)}</td>
                  <td className="px-3 py-2 text-right">
                    <EditLenderFundingModal
                      contractId={contractId}
                      contractPartyId={h.id}
                      fundedAmountCents={h.fundedAmountCents}
                      interestRateAnnual={h.interestRateAnnual}
                      fundingDate={h.fundingDate}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Previous Funding</h3>
        {past.length === 0 ? (
          <p className="text-sm text-slate-400">No previous funding on record.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Lender</th>
                  <th className="px-3 py-2">Funding Date</th>
                  <th className="px-3 py-2">End Date</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Interest Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {past.map((h) => (
                  <tr key={h.id}>
                    <td className="px-3 py-1.5 font-medium text-slate-900">{h.displayName}</td>
                    <td className="px-3 py-1.5 text-slate-600">{formatDate(h.fundingDate)}</td>
                    <td className="px-3 py-1.5 text-slate-600">{formatDate(h.endDate)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                      {formatCents(h.fundedAmountCents)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                      {formatPercent(h.interestRateAnnual)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
