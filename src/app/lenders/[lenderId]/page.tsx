import Link from "next/link";
import { eq, and, gt, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { parties } from "@/db/schema/parties";
import { contracts, contractParties } from "@/db/schema/contracts";
import { lenderLedgerEntries } from "@/db/schema/lending";
import { partyNotes, partyEmailDrafts } from "@/db/schema/notes";
import { bankAccounts } from "@/db/schema/setup";
import { formatCents, formatDate, formatPercent } from "@/lib/format";
import ContactInfoSection from "./_components/ContactInfoSection";
import SensitiveInfoSection from "./_components/SensitiveInfoSection";
import DocumentsSection from "./_components/DocumentsSection";
import PartyNotesSection from "./_components/PartyNotesSection";
import DefaultBankAccountSection from "./_components/DefaultBankAccountSection";
import OnlinePortalSection from "./_components/OnlinePortalSection";
import StatusSection from "./_components/StatusSection";
import ComposeEmailForm from "@/app/_components/ComposeEmailForm";

export default async function LenderDetailPage({ params }: { params: Promise<{ lenderId: string }> }) {
  const { lenderId } = await params;
  const [lender] = await db.select().from(parties).where(eq(parties.id, lenderId));
  if (!lender) return null;

  const bankAccountOptions = await db.select({ id: bankAccounts.id, label: bankAccounts.label }).from(bankAccounts).orderBy(bankAccounts.label);

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
      and(eq(contractParties.partyId, lenderId), eq(contractParties.role, "INVESTOR_PAYEE"), gt(contractParties.ownershipPercent, "0"))
    )
    .orderBy(contracts.contractNumber);

  const recentActivity = await db
    .select({
      id: lenderLedgerEntries.id,
      transactionDate: lenderLedgerEntries.transactionDate,
      reference: lenderLedgerEntries.reference,
      description: lenderLedgerEntries.description,
      amountReceivedCents: lenderLedgerEntries.amountReceivedCents,
      amountPaidOutCents: lenderLedgerEntries.amountPaidOutCents,
      contractId: contracts.id,
      contractNumber: contracts.contractNumber,
    })
    .from(lenderLedgerEntries)
    .leftJoin(contracts, eq(lenderLedgerEntries.sourceContractId, contracts.id))
    .where(eq(lenderLedgerEntries.lenderPartyId, lenderId))
    .orderBy(desc(lenderLedgerEntries.transactionDate))
    .limit(25);

  const totalActivity = recentActivity.reduce(
    (s, e) => s + (e.amountReceivedCents ?? 0) - (e.amountPaidOutCents ?? 0),
    0
  );

  const notes = await db
    .select()
    .from(partyNotes)
    .where(eq(partyNotes.partyId, lenderId))
    .orderBy(desc(partyNotes.createdAt));

  const outgoingEmails = await db
    .select()
    .from(partyEmailDrafts)
    .where(eq(partyEmailDrafts.partyId, lenderId))
    .orderBy(desc(partyEmailDrafts.createdAt));

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <Link href="/lenders" className="text-sm font-medium text-blue-700 hover:underline">
        ← All Lenders
      </Link>

      <div className="mt-2 mb-6">
        <h1 className="text-xl font-semibold text-slate-900">{lender.displayName}</h1>
        <p className="text-sm text-slate-500">
          {lender.email ? (
            <a href="#compose-email" className="text-blue-700 hover:underline">
              {lender.email}
            </a>
          ) : (
            "No email on file"
          )}
          {lender.portalPin ? ` · Portal PIN ${lender.portalPin}` : ""}
        </p>
        <p className="mt-2 text-sm text-slate-700">{fundedContracts.length} contracts funded</p>
      </div>

      <div className="mb-6">
        <StatusSection lenderId={lenderId} deactivated={lender.deactivated} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <ContactInfoSection
          lenderId={lenderId}
          firstName={lender.firstName}
          lastName={lender.lastName}
          companyName={lender.companyName}
          email={lender.email}
          phone={lender.phone}
          mailingAddressLine1={lender.mailingAddressLine1}
          mailingAddressLine2={lender.mailingAddressLine2}
          mailingCity={lender.mailingCity}
          mailingState={lender.mailingState}
          mailingZip={lender.mailingZip}
        />
        <SensitiveInfoSection
          lenderId={lenderId}
          taxIdLast4={lender.taxIdLast4}
          achBankName={lender.achBankName}
          achRoutingNumber={lender.achRoutingNumber}
          achAccountLast4={lender.achAccountLast4}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <DocumentsSection lenderId={lenderId} googleDriveFolderUrl={lender.googleDriveFolderUrl} />
        <PartyNotesSection lenderId={lenderId} notes={notes} />
      </div>

      <div className="mb-6 max-w-lg rounded-lg border border-slate-200 shadow-sm p-4">
        <h4 id="compose-email" className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Compose Email
        </h4>
        <ComposeEmailForm
          partyId={lenderId}
          revalidateBasePath="/lenders"
          defaultToAddress={lender.email}
          pendingEmails={outgoingEmails}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <DefaultBankAccountSection
          lenderId={lenderId}
          defaultBankAccountId={lender.defaultBankAccountId}
          bankAccountOptions={bankAccountOptions}
          preferredPaymentMethod={lender.preferredPaymentMethod}
        />
        <OnlinePortalSection
          key={lender.updatedAt.toISOString()}
          lenderId={lenderId}
          email={lender.email}
          portalPin={lender.portalPin}
          portalDeactivated={lender.portalDeactivated}
          portalLastLoginAt={lender.portalLastLoginAt}
        />
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
            {fundedContracts.map((c) => (
              <tr key={c.contractId} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/contracts/${c.contractId}`} prefetch={false} className="font-medium text-blue-700 hover:underline">
                    {c.contractNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-500">{c.status}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatPercent(c.ownershipPercent)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                  {formatCents(c.currentPrincipalBalanceCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recent Ledger Activity</h3>
        <span className="text-sm text-slate-700">
          Net (last {recentActivity.length}): <span className="font-medium">{formatCents(totalActivity)}</span>
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Land Contract</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {recentActivity.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No ledger activity recorded.
                </td>
              </tr>
            ) : (
              recentActivity.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{formatDate(e.transactionDate)}</td>
                  <td className="px-4 py-3 text-slate-400">{e.reference ?? "—"}</td>
                  <td className="px-4 py-3">
                    {e.contractId ? (
                      <Link href={`/contracts/${e.contractId}`} prefetch={false} className="font-medium text-blue-700 hover:underline">
                        {e.contractNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{e.description ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                    {formatCents((e.amountReceivedCents ?? 0) - (e.amountPaidOutCents ?? 0))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
