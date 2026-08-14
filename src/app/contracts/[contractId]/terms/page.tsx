import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts, contractParties } from "@/db/schema/contracts";
import { parties } from "@/db/schema/parties";
import { formatCents, formatDate, formatPercent } from "@/lib/format";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-b border-slate-100 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium tabular-nums text-slate-900">{value}</span>
    </div>
  );
}

export default async function ContractTermsPage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params;
  const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!contract) return null;

  const involvedParties = await db
    .select({ displayName: parties.displayName, role: contractParties.role, ownershipPercent: contractParties.ownershipPercent })
    .from(contractParties)
    .innerJoin(parties, eq(contractParties.partyId, parties.id))
    .where(eq(contractParties.contractId, contractId));

  const lenders = involvedParties.filter((p) => p.role === "INVESTOR_PAYEE");
  const buyers = involvedParties.filter((p) => p.role === "BUYER" || p.role === "CO_BUYER");

  return (
    <div>
      <Section title="General">
        <Field label="Original Amount" value={formatCents(contract.originalPrincipalCents)} />
        <Field label="Note Rate" value={formatPercent(contract.interestRateAnnual)} />
        <Field label="Priority" value={contract.lienPriority} />
        <Field label="Amortization Term" value={`${contract.amortizationTermMonths} months`} />
        <Field label="Payment Frequency" value={contract.paymentFrequency} />
        <Field label="Regular Payment" value={formatCents(contract.paymentAmountCents)} />
      </Section>

      <Section title="Important Dates">
        <Field label="Origination" value={formatDate(contract.originationDate)} />
        <Field label="First Payment" value={formatDate(contract.firstPaymentDate)} />
        <Field label="Maturity" value={formatDate(contract.maturityDate)} />
        <Field label="Paid Off" value={formatDate(contract.paidOffDate)} />
      </Section>

      {contract.hasBalloon && (
        <Section title="Balloon">
          <Field label="Balloon Amount" value={formatCents(contract.balloonAmountCents)} />
          <Field label="Balloon Due Date" value={formatDate(contract.balloonDueDate)} />
        </Section>
      )}

      <Section title="Penalties">
        <Field
          label="Late Fee"
          value={contract.lateFeeType === "FLAT" ? formatCents(contract.lateFeeAmountCents) : `${contract.lateFeePercent}%`}
        />
        <Field label="Grace Period" value={`${contract.lateFeeGraceDays ?? 0} days`} />
      </Section>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Buyer(s)</h3>
          {buyers.length === 0 ? (
            <p className="text-sm text-slate-400">None on file.</p>
          ) : (
            <ul className="space-y-1 text-sm text-slate-700">
              {buyers.map((b, i) => (
                <li key={i}>
                  {b.displayName} <span className="text-slate-400">({b.role === "CO_BUYER" ? "Co-Buyer" : "Buyer"})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Lender(s)</h3>
          {lenders.length === 0 ? (
            <p className="text-sm text-slate-400">None on file.</p>
          ) : (
            <ul className="space-y-1 text-sm text-slate-700">
              {lenders.map((l, i) => (
                <li key={i} className="flex justify-between">
                  <span className={Number(l.ownershipPercent) === 0 ? "text-slate-400" : ""}>{l.displayName}</span>
                  <span className="tabular-nums text-slate-500">{formatPercent(l.ownershipPercent)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
