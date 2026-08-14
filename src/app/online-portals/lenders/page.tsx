import Link from "next/link";
import { eq, and, gt, desc, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { parties } from "@/db/schema/parties";
import { contracts, contractParties } from "@/db/schema/contracts";
import { lenderLedgerEntries } from "@/db/schema/lending";
import { postedLenderDocuments } from "@/db/schema/postedLenderDocuments";
import { formatCents, formatDate, formatPercent } from "@/lib/format";
import { getLenderPortalSession } from "@/lib/lenderPortalSession";
import PortalHeader from "../_components/PortalHeader";
import LoginForm from "./_components/LoginForm";
import LogoutButton from "./_components/LogoutButton";
import PostedDocumentsSection from "../../_components/PostedDocumentsSection";

const DOCUMENT_LABELS: Record<string, string> = {
  ACCRUED_INTEREST: "Accrued Interest",
  PRINCIPAL_CHANGE: "Portfolio Change in Principal",
  PORTFOLIO_CHARGES: "Portfolio Charges",
};

async function getEntityNames(partyIds: string[]) {
  return db
    .select({ id: parties.id, displayName: parties.displayName })
    .from(parties)
    .where(and(inArray(parties.id, partyIds), eq(parties.portalDeactivated, false)));
}

async function getLenderPortalData(partyId: string) {
  const [lender] = await db.select().from(parties).where(eq(parties.id, partyId));
  // Re-checked on every page load, not just at login — a lender deactivated
  // after their 7-day session cookie was issued must still be locked out
  // immediately, not just the next time they'd otherwise log in fresh.
  if (!lender || lender.portalDeactivated) return null;

  const fundedContracts = await db
    .select({
      contractId: contracts.id,
      contractNumber: contracts.contractNumber,
      ownershipPercent: contractParties.ownershipPercent,
      status: contracts.status,
      currentPrincipalBalanceCents: contracts.currentPrincipalBalanceCents,
    })
    .from(contractParties)
    .innerJoin(contracts, eq(contractParties.contractId, contracts.id))
    .where(
      and(eq(contractParties.partyId, partyId), eq(contractParties.role, "INVESTOR_PAYEE"), gt(contractParties.ownershipPercent, "0"))
    )
    .orderBy(contracts.contractNumber);

  const ledger = await db
    .select({
      id: lenderLedgerEntries.id,
      transactionDate: lenderLedgerEntries.transactionDate,
      reference: lenderLedgerEntries.reference,
      description: lenderLedgerEntries.description,
      amountReceivedCents: lenderLedgerEntries.amountReceivedCents,
      amountPaidOutCents: lenderLedgerEntries.amountPaidOutCents,
      balanceCents: lenderLedgerEntries.balanceCents,
      contractNumber: contracts.contractNumber,
    })
    .from(lenderLedgerEntries)
    .leftJoin(contracts, eq(lenderLedgerEntries.sourceContractId, contracts.id))
    .where(eq(lenderLedgerEntries.lenderPartyId, partyId))
    .orderBy(desc(lenderLedgerEntries.transactionDate))
    .limit(50);

  const postedDocuments = await db
    .select()
    .from(postedLenderDocuments)
    .where(eq(postedLenderDocuments.lenderPartyId, partyId))
    .orderBy(desc(postedLenderDocuments.postedAt));

  return { lender, fundedContracts, ledger, postedDocuments };
}

export default async function LenderPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const partyIds = await getLenderPortalSession();

  if (!partyIds || partyIds.length === 0) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <LoginForm />
      </main>
    );
  }

  const { as } = await searchParams;
  const selectedId = as && partyIds.includes(as) ? as : partyIds.length === 1 ? partyIds[0] : null;

  if (!selectedId) {
    const entities = await getEntityNames(partyIds);
    entities.sort((a, b) => a.displayName.localeCompare(b.displayName));

    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <PortalHeader />
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Select an Account</h1>
            <p className="text-sm text-slate-500">Your login is linked to {entities.length} lender accounts.</p>
          </div>
          <LogoutButton />
        </div>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {entities.map((e) => (
            <li key={e.id}>
              <Link
                href={`/online-portals/lenders?as=${e.id}`}
                className="block px-4 py-3 text-sm font-medium text-blue-700 hover:bg-slate-50 hover:underline"
              >
                {e.displayName}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  const data = await getLenderPortalData(selectedId);
  if (!data) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <LoginForm />
      </main>
    );
  }
  const { lender, fundedContracts, ledger, postedDocuments } = data;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PortalHeader />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Welcome, {lender.displayName}</h1>
          <p className="text-sm text-slate-500">{fundedContracts.length} contracts funded</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {partyIds.length > 1 && (
            <Link href="/online-portals/lenders" className="text-sm font-medium text-blue-700 hover:underline">
              Switch Account
            </Link>
          )}
          <LogoutButton />
        </div>
      </div>

      <div className="mb-8 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Land Contract</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ownership %</th>
              <th className="px-4 py-3 text-right">Principal Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {fundedContracts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  No contracts on file.
                </td>
              </tr>
            ) : (
              fundedContracts.map((c) => (
                <tr key={c.contractId}>
                  <td className="px-4 py-3 font-medium text-slate-900">{c.contractNumber}</td>
                  <td className="px-4 py-3 text-slate-500">{c.status}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatPercent(c.ownershipPercent)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                    {formatCents(c.currentPrincipalBalanceCents)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PostedDocumentsSection documents={postedDocuments} labels={DOCUMENT_LABELS} />

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Ledger Activity</h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Land Contract</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ledger.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No ledger activity recorded.
                </td>
              </tr>
            ) : (
              ledger.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 text-slate-600">{formatDate(e.transactionDate)}</td>
                  <td className="px-4 py-3 text-slate-400">{e.reference ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{e.contractNumber ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{e.description ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                    {formatCents((e.amountReceivedCents ?? 0) - (e.amountPaidOutCents ?? 0))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatCents(e.balanceCents)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
