import Link from "next/link";
import { eq, and, gt } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { contracts, contractParties } from "@/db/schema/contracts";
import { parties, properties } from "@/db/schema/parties";
import { checkPrincipalPaydownEligibility } from "@/server/payments";
import { ContractTabs } from "./_components/ContractTabs";
import PrincipalPaydownButton from "./_components/PrincipalPaydownButton";

async function getHeaderData(contractId: string) {
  const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!contract) return null;

  const [property] = contract.propertyId
    ? await db.select().from(properties).where(eq(properties.id, contract.propertyId))
    : [];

  const buyerRows = await db
    .select({ partyId: parties.id, displayName: parties.displayName })
    .from(contractParties)
    .innerJoin(parties, eq(contractParties.partyId, parties.id))
    .where(and(eq(contractParties.contractId, contractId), eq(contractParties.role, "BUYER")));

  const lenderRows = await db
    .select({ partyId: parties.id, displayName: parties.displayName })
    .from(contractParties)
    .innerJoin(parties, eq(contractParties.partyId, parties.id))
    .where(
      and(
        eq(contractParties.contractId, contractId),
        eq(contractParties.role, "INVESTOR_PAYEE"),
        gt(contractParties.ownershipPercent, "0")
      )
    );

  return { contract, property, buyers: buyerRows, lenders: lenderRows };
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  PAID_OFF: "bg-slate-100 text-slate-600 ring-slate-500/20",
  DEFAULTED: "bg-red-50 text-red-700 ring-red-600/20",
  IN_FORECLOSURE: "bg-red-50 text-red-700 ring-red-600/20",
  CANCELLED: "bg-slate-100 text-slate-500 ring-slate-500/20",
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  PAID_OFF: "Paid Off",
  DEFAULTED: "Defaulted",
  IN_FORECLOSURE: "In Foreclosure",
  CANCELLED: "Cancelled",
};

// Land Contract is ~95% of the book, so it's the unmarked default — only the
// other loan types get a badge, same as Balloon only showing when true.
const LOAN_TYPE_LABEL: Record<string, string> = {
  FIRST_LIEN: "1st Lien",
  SECOND_LIEN: "2nd Lien",
  UNSECURED: "Unsecured",
};

const PROPERTY_TYPE_LABEL: Record<string, string> = {
  SINGLE_FAMILY: "SFR",
  MULTI_FAMILY: "Multi Family",
  COMMERCIAL: "Commercial",
  OTHER: "Other",
};

export default async function ContractLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
  const [data, paydownEligibility] = await Promise.all([
    getHeaderData(contractId),
    checkPrincipalPaydownEligibility(contractId),
  ]);
  if (!data) notFound();
  const { contract, property, buyers, lenders } = data;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6">
        <Link href="/contracts" className="text-sm text-slate-500 hover:text-slate-700">
          ← All Contracts
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-slate-900">
                {buyers.length > 0 ? (
                  buyers.map((b, i) => (
                    <span key={b.partyId}>
                      {i > 0 && " & "}
                      <Link href={`/borrowers/${b.partyId}`} className="hover:underline">
                        {b.displayName}
                      </Link>
                    </span>
                  ))
                ) : (
                  "Unknown Buyer"
                )}
              </h1>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                  STATUS_STYLES[contract.status] ?? "bg-slate-100 text-slate-600 ring-slate-500/20"
                }`}
              >
                {STATUS_LABEL[contract.status] ?? contract.status}
              </span>
              {contract.hasBalloon && (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                  Balloon
                </span>
              )}
              {LOAN_TYPE_LABEL[contract.loanType] && (
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
                  {LOAN_TYPE_LABEL[contract.loanType]}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Account #{contract.contractNumber}
              {property && (
                <>
                  {" · "}
                  <Link href={`/properties/${property.id}`} prefetch={false} className="hover:underline">
                    {property.streetAddress}, {property.city}, {property.state} {property.zip}
                  </Link>
                  {property.propertyType && ` · ${PROPERTY_TYPE_LABEL[property.propertyType] ?? property.propertyType}`}
                </>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-400">Principal Balance</p>
            <p className="text-xl font-semibold tabular-nums text-slate-900">
              {(contract.currentPrincipalBalanceCents / 100).toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
            </p>
            {lenders.length > 0 && (
              <p className="mt-1 text-sm text-slate-500">
                {lenders.map((l, i) => (
                  <span key={l.partyId}>
                    {i > 0 && ", "}
                    <Link href={`/lenders/${l.partyId}`} className="text-blue-700 hover:underline">
                      {l.displayName}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>

        <ContractTabs
          contractId={contractId}
          extra={
            <div className="ml-auto flex items-center gap-3">
              <PrincipalPaydownButton
                contractId={contractId}
                eligible={paydownEligibility.eligible}
                ineligibleReason={paydownEligibility.reason}
                currentPrincipalBalanceCents={contract.currentPrincipalBalanceCents}
              />
            </div>
          }
        />

        <div className="p-6">{children}</div>
      </div>
    </main>
  );
}
