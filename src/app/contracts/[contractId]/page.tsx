import Link from "next/link";
import { eq, desc, and, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts, contractParties } from "@/db/schema/contracts";
import { parties } from "@/db/schema/parties";
import { payments, paymentAllocations } from "@/db/schema/payments";
import { trustLedgerEntries } from "@/db/schema/escrow";
import { contractNotes } from "@/db/schema/notes";
import { calculateAmountDue, daysPastDue } from "@/domain/ledger/calculateAmountDue";
import { regressNextPaymentDate } from "@/domain/ledger/advanceNextPaymentDate";
import { getUnpaidChargesCents, getCurrentEscrowPortionCents, getEscrowAndReserveBalances } from "@/server/payments";
import { contractHasPayments } from "@/server/contractDeletion";
import { formatCents, formatDate, formatPercent } from "@/lib/format";
import RecordPaymentModal from "./_components/RecordPaymentModal";
import NotesSection from "./_components/NotesSection";
import StatusCard from "./_components/StatusCard";
import LoanTypeField from "./_components/LoanTypeField";
import EscrowSettingsField from "./_components/EscrowSettingsField";
import AttachmentsSection from "./_components/AttachmentsSection";
import ReversePaymentButton from "./_components/ReversePaymentButton";
import DangerZoneCard from "./_components/DangerZoneCard";


async function getBuyerContact(contractId: string) {
  const [row] = await db
    .select({
      displayName: parties.displayName,
      phone: parties.phone,
      mailingAddressLine1: parties.mailingAddressLine1,
      mailingCity: parties.mailingCity,
      mailingState: parties.mailingState,
      mailingZip: parties.mailingZip,
    })
    .from(contractParties)
    .innerJoin(parties, eq(contractParties.partyId, parties.id))
    .where(and(eq(contractParties.contractId, contractId), eq(contractParties.role, "BUYER")));
  return row ?? null;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 shadow-sm p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium tabular-nums text-slate-900">{value}</span>
    </div>
  );
}

export default async function ContractOverviewPage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params;
  const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!contract) return null;

  const recentPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.contractId, contractId))
    .orderBy(desc(payments.receivedDate), desc(payments.createdAt))
    .limit(5);

  // Only the most recent original (non-reversal) CLEARED payment may be
  // reversed — see reversePayment() in server/payments.ts for why.
  const reversiblePaymentId = recentPayments.find((p) => p.status === "CLEARED" && p.reversedPaymentId === null)?.id ?? null;

  const recentPaymentIds = recentPayments.map((p) => p.id);
  const allocationRows =
    recentPaymentIds.length > 0
      ? await db
          .select({
            paymentId: paymentAllocations.paymentId,
            allocationType: paymentAllocations.allocationType,
            amountCents: paymentAllocations.amountCents,
          })
          .from(paymentAllocations)
          .where(inArray(paymentAllocations.paymentId, recentPaymentIds))
      : [];

  const breakdownByPaymentId = new Map<
    string,
    { principalCents: number; interestCents: number; escrowCents: number; chargesCents: number; lateFeeCents: number }
  >();
  for (const row of allocationRows) {
    const entry = breakdownByPaymentId.get(row.paymentId) ?? {
      principalCents: 0,
      interestCents: 0,
      escrowCents: 0,
      chargesCents: 0,
      lateFeeCents: 0,
    };
    if (row.allocationType === "PRINCIPAL") entry.principalCents += row.amountCents;
    else if (row.allocationType === "INTEREST") entry.interestCents += row.amountCents;
    else if (row.allocationType === "ESCROW_TAX" || row.allocationType === "ESCROW_INSURANCE") entry.escrowCents += row.amountCents;
    else if (row.allocationType === "OTHER_FEE") entry.chargesCents += row.amountCents;
    else if (row.allocationType === "LATE_FEE") entry.lateFeeCents += row.amountCents;
    breakdownByPaymentId.set(row.paymentId, entry);
  }

  const recentEscrow = await db
    .select()
    .from(trustLedgerEntries)
    .where(eq(trustLedgerEntries.contractId, contractId))
    .orderBy(desc(trustLedgerEntries.transactionDate))
    .limit(5);

  const { escrowBalanceCents, reserveBalanceCents } = await getEscrowAndReserveBalances(contractId);
  const currentEscrowPortionCents = await getCurrentEscrowPortionCents(contractId);
  const buyerContact = await getBuyerContact(contractId);
  const unpaidChargesCents = await getUnpaidChargesCents(contractId);

  const amountDue = calculateAmountDue({
    paymentAmountCents: contract.paymentAmountCents,
    daysPastDue: daysPastDue(contract.nextPaymentDate),
    lateFeeGraceDays: contract.lateFeeGraceDays,
    lateFeeType: contract.lateFeeType,
    lateFeeAmountCents: contract.lateFeeAmountCents,
    lateFeePercent: contract.lateFeePercent,
  });
  // calculateAmountDue only covers P&I + late fee (late-fee-percent math is
  // keyed off P&I per its own comment) — escrow is collected on top of that
  // per period, so the borrower's actual full payment due is P&I + escrow.
  const fullAmountDueCents = amountDue.amountDueCents + currentEscrowPortionCents;
  // TMO's "Paid to Date" — the due date one period before what's currently
  // due, i.e. the last period interest has actually been satisfied through.
  const paidToDate = contract.nextPaymentDate
    ? regressNextPaymentDate(contract.nextPaymentDate, contract.paymentFrequency)
    : null;

  const notes = await db
    .select()
    .from(contractNotes)
    .where(eq(contractNotes.contractId, contractId))
    .orderBy(desc(contractNotes.createdAt));

  const hasPayments = await contractHasPayments(contractId);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title="Loan Terms">
          <LoanTypeField contractId={contractId} loanType={contract.loanType} />
          <Field label="Regular Payment (P&I)" value={formatCents(contract.paymentAmountCents)} />
          <Field
            label="Regular Payment (Total)"
            value={formatCents(contract.paymentAmountCents + currentEscrowPortionCents)}
          />
          <Field label="Frequency" value={contract.paymentFrequency} />
          <Field label="Note Rate" value={formatPercent(contract.interestRateAnnual)} />
          <Field label="Original Amount" value={formatCents(contract.originalPrincipalCents)} />
          <Field label="Term" value={`${contract.amortizationTermMonths} months`} />
          <EscrowSettingsField
            contractId={contractId}
            escrowRequired={contract.escrowRequired}
            monthlyEscrowPaymentCents={contract.monthlyEscrowPaymentCents}
          />
        </Card>

        <Card title="Balances">
          <Field label="Principal Balance" value={formatCents(contract.currentPrincipalBalanceCents)} />
          <Field label="Late Fee" value={formatCents(contract.lateFeeAmountCents)} />
          <Field label="Grace Days" value={contract.lateFeeGraceDays ?? "—"} />
          {contract.hasBalloon && (
            <>
              <Field label="Balloon Amount" value={formatCents(contract.balloonAmountCents)} />
              <Field label="Balloon Due" value={formatDate(contract.balloonDueDate)} />
            </>
          )}
          <Field label="Reserve Balance" value={formatCents(Math.max(0, reserveBalanceCents))} />
          <Field label="Escrow Balance" value={formatCents(escrowBalanceCents)} />
          {unpaidChargesCents > 0 && <Field label="Unpaid Charges" value={formatCents(unpaidChargesCents)} />}
        </Card>

        <Card title="Key Dates">
          <Field label="Origination" value={formatDate(contract.originationDate)} />
          <Field label="First Payment" value={formatDate(contract.firstPaymentDate)} />
          <Field label="Next Payment Due" value={formatDate(contract.nextPaymentDate)} />
          <Field label="Maturity" value={formatDate(contract.maturityDate)} />
          <Field label="Paid Off" value={formatDate(contract.paidOffDate)} />
        </Card>
      </div>

      <StatusCard
        contractId={contractId}
        contractStatus={contract.status}
        daysPastDue={daysPastDue(contract.nextPaymentDate)}
        forfeitureNoticeSentDate={contract.forfeitureNoticeSentDate}
        courtHearingDate={contract.courtHearingDate}
        judgmentReceivedDate={contract.judgmentReceivedDate}
        evictionDate={contract.evictionDate}
        legalProcessStage={contract.legalProcessStage}
        inBankruptcy={contract.inBankruptcy}
      />

      <Card title="Borrower Contact">
        <Field label="Phone" value={buyerContact?.phone ?? "—"} />
        <Field
          label="Email"
          value={
            contract.borrowerPortalEmail ? (
              <a href={`mailto:${contract.borrowerPortalEmail}`} className="text-blue-700 hover:underline">
                {contract.borrowerPortalEmail}
              </a>
            ) : (
              "—"
            )
          }
        />
        <Field label="Portal PIN" value={contract.borrowerPortalPin ?? "—"} />
        <Field
          label="Mailing Address"
          value={
            buyerContact?.mailingAddressLine1
              ? `${buyerContact.mailingAddressLine1}, ${buyerContact.mailingCity}, ${buyerContact.mailingState} ${buyerContact.mailingZip}`
              : "—"
          }
        />
      </Card>

      <Card title="Make a Payment">
        <Field label="Amount Due" value={formatCents(fullAmountDueCents)} />
        <Field label="Reserve Balance" value={formatCents(Math.max(0, reserveBalanceCents))} />
        <div className="mt-3">
          <RecordPaymentModal
            // RecordPaymentModal seeds its editable fields (amount, escrow
            // portion, late fee...) via useState(defaultX) — that only runs
            // on mount, so if the contract's escrow settings (or any other
            // default-affecting field) change while the modal is already
            // mounted, its fields would silently keep showing the old
            // defaults. Forces a remount whenever any of them change —
            // same fix already used for OnlinePortalSection.
            key={[
              contract.currentPrincipalBalanceCents,
              reserveBalanceCents,
              escrowBalanceCents,
              contract.paymentAmountCents,
              currentEscrowPortionCents,
              fullAmountDueCents,
              amountDue.lateFeeCents,
              unpaidChargesCents,
            ].join("-")}
            contractId={contractId}
            contractNumber={contract.contractNumber}
            borrowerName={buyerContact?.displayName ?? "Unknown Buyer"}
            currentPrincipalBalanceCents={contract.currentPrincipalBalanceCents}
            reserveBalanceCents={reserveBalanceCents}
            escrowBalanceCents={escrowBalanceCents}
            regularPaymentTotalCents={contract.paymentAmountCents + currentEscrowPortionCents}
            regularPaymentAmountCents={contract.paymentAmountCents}
            paidToDate={paidToDate}
            nextPaymentDate={contract.nextPaymentDate}
            maturityDate={contract.maturityDate}
            annualRatePercent={Number(contract.interestRateAnnual)}
            amountDueCents={fullAmountDueCents}
            lateFeeCents={amountDue.lateFeeCents}
            isLate={amountDue.isLate}
            defaultEscrowPortionCents={currentEscrowPortionCents}
            unpaidChargesCents={unpaidChargesCents}
          />
        </div>
      </Card>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recent Payments</h3>
          <Link href={`/contracts/${contractId}/history`} className="text-xs font-medium text-blue-700 hover:underline">
            View all
          </Link>
        </div>
        {recentPayments.length === 0 ? (
          <p className="text-sm text-slate-400">No payments recorded.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Principal</th>
                  <th className="px-3 py-2 text-right">Interest</th>
                  <th className="px-3 py-2 text-right">Escrow</th>
                  <th className="px-3 py-2 text-right">Charges</th>
                  <th className="px-3 py-2 text-right">Late Fee</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentPayments.map((p) => {
                  const b = breakdownByPaymentId.get(p.id);
                  return (
                    <tr key={p.id}>
                      <td className="px-3 py-1.5 text-slate-500">{formatDate(p.receivedDate)}</td>
                      <td className="px-3 py-1.5 text-slate-600">
                        {p.legacyDescription ?? "Payment"}
                        {p.status === "REVERSED" && (
                          <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Reversed</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{formatCents(b?.principalCents ?? 0)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{formatCents(b?.interestCents ?? 0)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{formatCents(b?.escrowCents ?? 0)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{formatCents(b?.chargesCents ?? 0)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{formatCents(b?.lateFeeCents ?? 0)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-medium text-slate-900">
                        {formatCents(p.amountCents)}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {p.id === reversiblePaymentId && <ReversePaymentButton contractId={contractId} paymentId={p.id} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recent Escrow Activity</h3>
          <Link href={`/contracts/${contractId}/trust-ledger`} className="text-xs font-medium text-blue-700 hover:underline">
            View all
          </Link>
        </div>
        {recentEscrow.length === 0 ? (
          <p className="text-sm text-slate-400">No escrow vouchers available.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {recentEscrow.map((e) => (
                <tr key={e.id}>
                  <td className="py-1.5 text-slate-500">{formatDate(e.transactionDate)}</td>
                  <td className="py-1.5 text-slate-600">{e.payeeOrPayerName ?? "—"}</td>
                  <td className="py-1.5 text-right tabular-nums font-medium text-slate-900">
                    {formatCents(e.amountPaidOutCents ?? (e.amountReceivedCents ? -e.amountReceivedCents : null))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <NotesSection contractId={contractId} notes={notes} />

      <AttachmentsSection contractId={contractId} googleDriveFolderUrl={contract.googleDriveFolderUrl} />

      <DangerZoneCard contractId={contractId} contractNumber={contract.contractNumber} hasPayments={hasPayments} />
    </div>
  );
}
