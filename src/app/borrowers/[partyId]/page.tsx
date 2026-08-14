import Link from "next/link";
import { eq, and, desc, inArray, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { parties, properties } from "@/db/schema/parties";
import { contracts, contractParties } from "@/db/schema/contracts";
import { partyNotes, partyEmails, partyEmailDrafts } from "@/db/schema/notes";
import { formatCents, formatDateTime } from "@/lib/format";
import PartyNotesSection from "./_components/PartyNotesSection";
import ComposeEmailForm from "@/app/_components/ComposeEmailForm";
import BorrowerContactInfoSection from "./_components/BorrowerContactInfoSection";
import BorrowerTaxInfoSection from "./_components/BorrowerTaxInfoSection";
import BorrowerOnlinePortalSection from "./_components/BorrowerOnlinePortalSection";
import CoBorrowersSection from "./_components/CoBorrowersSection";

export default async function BorrowerDetailPage({ params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const [party] = await db.select().from(parties).where(eq(parties.id, partyId));
  if (!party) return null;

  const landContracts = await db
    .select({
      contractId: contracts.id,
      contractNumber: contracts.contractNumber,
      status: contracts.status,
      inBankruptcy: contracts.inBankruptcy,
      currentPrincipalBalanceCents: contracts.currentPrincipalBalanceCents,
      googleDriveFolderUrl: contracts.googleDriveFolderUrl,
      borrowerPortalEmail: contracts.borrowerPortalEmail,
      borrowerPortalPin: contracts.borrowerPortalPin,
      borrowerPortalDeactivated: contracts.borrowerPortalDeactivated,
      borrowerPortalLastLoginAt: contracts.borrowerPortalLastLoginAt,
      streetAddress: properties.streetAddress,
      city: properties.city,
      state: properties.state,
    })
    .from(contractParties)
    .innerJoin(contracts, eq(contractParties.contractId, contracts.id))
    .leftJoin(properties, eq(contracts.propertyId, properties.id))
    .where(and(eq(contractParties.partyId, partyId), eq(contractParties.role, "BUYER")))
    .orderBy(contracts.contractNumber);

  const notes = await db
    .select()
    .from(partyNotes)
    .where(eq(partyNotes.partyId, partyId))
    .orderBy(desc(partyNotes.createdAt));

  const emails = await db
    .select()
    .from(partyEmails)
    .where(eq(partyEmails.partyId, partyId))
    .orderBy(desc(partyEmails.sentAt));

  const outgoingEmails = await db
    .select()
    .from(partyEmailDrafts)
    .where(eq(partyEmailDrafts.partyId, partyId))
    .orderBy(desc(partyEmailDrafts.createdAt));

  // Portal PIN/deactivation/last-login all live on contracts (shared per
  // loan account, per co-buyers), not on parties — the Online Portal box
  // manages the first/primary land contract's portal. Borrowers with more
  // than one contract only get this one shown/edited here.
  const primaryContract = landContracts[0] ?? null;

  const documentLinks = landContracts.filter((c) => c.googleDriveFolderUrl);
  const defaultToAddress = party.email ?? landContracts.find((c) => c.borrowerPortalEmail)?.borrowerPortalEmail ?? null;
  // An automatic bankruptcy stay blocks ALL creditor communication — checked
  // across every contract this borrower is on, not just the primary one.
  const isInBankruptcy = landContracts.some((c) => c.inBankruptcy);

  const contractIds = landContracts.map((c) => c.contractId);
  const coBorrowers =
    contractIds.length === 0
      ? []
      : await db
          .select({
            partyId: parties.id,
            displayName: parties.displayName,
            role: contractParties.role,
            contractNumber: contracts.contractNumber,
          })
          .from(contractParties)
          .innerJoin(contracts, eq(contractParties.contractId, contracts.id))
          .innerJoin(parties, eq(contractParties.partyId, parties.id))
          .where(
            and(
              inArray(contractParties.contractId, contractIds),
              inArray(contractParties.role, ["BUYER", "CO_BUYER"]),
              ne(contractParties.partyId, partyId)
            )
          )
          .orderBy(contracts.contractNumber, parties.displayName);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <Link href="/borrowers" className="text-sm font-medium text-blue-700 hover:underline">
        ← All Borrowers
      </Link>

      <div className="mt-2 mb-6">
        <h1 className="text-xl font-semibold text-slate-900">{party.displayName}</h1>
        <p className="text-sm text-slate-500">
          {party.email && (
            <>
              <a href="#compose-email" className="text-blue-700 hover:underline">
                {party.email}
              </a>
              {" · "}
            </>
          )}
          {party.phone ?? "No phone on file"}
          {party.mailingAddressLine1
            ? ` · ${party.mailingAddressLine1}, ${party.mailingCity}, ${party.mailingState} ${party.mailingZip}`
            : ""}
        </p>
      </div>

      <div className="mb-8">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Land Contracts</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Principal Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {landContracts.map((c) => (
                <tr key={c.contractId} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/contracts/${c.contractId}`} prefetch={false} className="font-medium text-blue-700 hover:underline">
                      {c.contractNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {c.streetAddress ? `${c.streetAddress}, ${c.city}, ${c.state}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.status}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                    {formatCents(c.currentPrincipalBalanceCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <BorrowerContactInfoSection
          // Remounts whenever the party row actually changes, so uncontrolled
          // fields (defaultValue/defaultChecked) always re-initialize from
          // fresh data after a save — otherwise React keeps the DOM's stale
          // pre-save state even though the database update succeeded.
          key={party.updatedAt.toISOString()}
          partyId={partyId}
          salutation={party.salutation}
          firstName={party.firstName}
          middleInitial={party.middleInitial}
          lastName={party.lastName}
          email={party.email}
          emailFormat={party.emailFormat}
          phoneHome={party.phoneHome}
          phoneWork={party.phoneWork}
          phoneMobile={party.phoneMobile}
          phoneFax={party.phoneFax}
          mailingAddressLine1={party.mailingAddressLine1}
          mailingAddressLine2={party.mailingAddressLine2}
          mailingCity={party.mailingCity}
          mailingState={party.mailingState}
          mailingZip={party.mailingZip}
          mailingCountry={party.mailingCountry}
          deliveryByPrint={party.deliveryByPrint}
          deliveryByEmail={party.deliveryByEmail}
          deliveryBySms={party.deliveryBySms}
        />
        <BorrowerTaxInfoSection
          key={party.updatedAt.toISOString()}
          partyId={partyId}
          taxIdLast4={party.taxIdLast4}
          legalStructure={party.legalStructure}
          dateOfBirth={party.dateOfBirth}
          tinType={party.tinType}
          onHold={party.onHold}
          alternateTaxInfo={party.alternateTaxInfo}
          sendTaxReporting={party.sendTaxReporting}
          sendLateNotices={party.sendLateNotices}
          sendPaymentReceipts={party.sendPaymentReceipts}
          sendPaymentStatements={party.sendPaymentStatements}
        />
      </div>

      <div className="mb-8 max-w-sm">
        <BorrowerOnlinePortalSection
          key={`${primaryContract?.contractId ?? ""}-${primaryContract?.borrowerPortalDeactivated ?? false}-${primaryContract?.borrowerPortalPin ?? ""}`}
          partyId={partyId}
          contractId={primaryContract?.contractId ?? null}
          borrowerPortalEmail={primaryContract?.borrowerPortalEmail ?? null}
          borrowerPortalPin={primaryContract?.borrowerPortalPin ?? null}
          borrowerPortalDeactivated={primaryContract?.borrowerPortalDeactivated ?? false}
          borrowerPortalLastLoginAt={primaryContract?.borrowerPortalLastLoginAt ?? null}
        />
      </div>

      <CoBorrowersSection coBorrowers={coBorrowers} />

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Communications</h3>
        {isInBankruptcy && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-800 ring-1 ring-inset ring-red-600/20">
            This borrower is in bankruptcy. Do not send late notices or initiate contact — the automatic stay
            prohibits creditor communication. Only respond if they contact us first.
          </p>
        )}
        <div className="rounded-lg border border-slate-200 shadow-sm p-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Documents</h4>
          {documentLinks.length === 0 ? (
            <p className="mb-4 text-sm text-slate-400">No Google Drive folders linked yet.</p>
          ) : (
            <ul className="mb-4 space-y-1">
              {documentLinks.map((c) => (
                <li key={c.contractId}>
                  <a
                    href={c.googleDriveFolderUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline"
                  >
                    {c.contractNumber} Documents ↗
                  </a>
                </li>
              ))}
            </ul>
          )}

          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Emails</h4>
          {emails.length === 0 ? (
            <p className="mb-4 text-sm text-slate-400">
              No emails captured yet. Ask staff to run a communications sync to pull matching messages from
              info@successgroupmortgage.com.
            </p>
          ) : (
            <ul className="mb-4 space-y-3">
              {emails.map((e) => (
                <li key={e.id} className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
                  <p className="text-sm font-medium text-slate-900">{e.subject ?? "(no subject)"}</p>
                  <p className="text-xs text-slate-400">
                    {e.sender} → {e.recipients} · {formatDateTime(e.sentAt)}
                  </p>
                  {e.snippet && <p className="mt-1 text-sm text-slate-600">{e.snippet}</p>}
                </li>
              ))}
            </ul>
          )}

          <h4 id="compose-email" className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Compose Email
          </h4>
          <ComposeEmailForm
            partyId={partyId}
            revalidateBasePath="/borrowers"
            defaultToAddress={defaultToAddress}
            pendingEmails={outgoingEmails}
          />

          <h4 className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</h4>
          <PartyNotesSection partyId={partyId} notes={notes} />
        </div>
      </div>
    </main>
  );
}
