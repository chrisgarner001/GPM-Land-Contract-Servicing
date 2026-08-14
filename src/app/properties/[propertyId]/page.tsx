import Link from "next/link";
import { eq, and, gt, isNull, inArray, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { properties } from "@/db/schema/parties";
import { contracts, contractParties } from "@/db/schema/contracts";
import { parties } from "@/db/schema/parties";
import { vendors } from "@/db/schema/vendors";
import { propertyAssessorSnapshots } from "@/db/schema/assessorSearch";
import { formatCents } from "@/lib/format";
import PropertyDetailsSection from "./_components/PropertyDetailsSection";
import AssessorDataCard from "./_components/AssessorDataCard";

export default async function PropertyDetailPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const [property] = await db.select().from(properties).where(eq(properties.id, propertyId));
  if (!property) return null;

  const vendorOptions = await db.select({ id: vendors.id, displayName: vendors.displayName }).from(vendors).orderBy(vendors.displayName);

  const [latestAssessorSnapshot] = await db
    .select()
    .from(propertyAssessorSnapshots)
    .where(eq(propertyAssessorSnapshots.propertyId, propertyId))
    .orderBy(desc(propertyAssessorSnapshots.fetchedAt))
    .limit(1);

  const propertyContracts = await db
    .select({
      id: contracts.id,
      contractNumber: contracts.contractNumber,
      status: contracts.status,
      currentPrincipalBalanceCents: contracts.currentPrincipalBalanceCents,
    })
    .from(contracts)
    .where(eq(contracts.propertyId, propertyId))
    .orderBy(contracts.contractNumber);

  const contractIds = propertyContracts.map((c) => c.id);

  const buyerRows =
    contractIds.length > 0
      ? await db
          .select({ contractId: contractParties.contractId, partyId: parties.id, displayName: parties.displayName })
          .from(contractParties)
          .innerJoin(parties, eq(contractParties.partyId, parties.id))
          .where(and(inArray(contractParties.contractId, contractIds), eq(contractParties.role, "BUYER")))
      : [];

  const lenderRows =
    contractIds.length > 0
      ? await db
          .select({ contractId: contractParties.contractId, partyId: parties.id, displayName: parties.displayName })
          .from(contractParties)
          .innerJoin(parties, eq(contractParties.partyId, parties.id))
          .where(
            and(
              inArray(contractParties.contractId, contractIds),
              eq(contractParties.role, "INVESTOR_PAYEE"),
              gt(contractParties.ownershipPercent, "0"),
              isNull(contractParties.endDate)
            )
          )
      : [];

  const buyersByContract = new Map<string, typeof buyerRows>();
  for (const r of buyerRows) {
    const list = buyersByContract.get(r.contractId) ?? [];
    list.push(r);
    buyersByContract.set(r.contractId, list);
  }
  const lendersByContract = new Map<string, typeof lenderRows>();
  for (const r of lenderRows) {
    const list = lendersByContract.get(r.contractId) ?? [];
    list.push(r);
    lendersByContract.set(r.contractId, list);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/properties" className="text-sm font-medium text-blue-700 hover:underline">
        ← All Properties
      </Link>

      <div className="mt-2 mb-6">
        <h1 className="text-xl font-semibold text-slate-900">{property.streetAddress}</h1>
        <p className="text-sm text-slate-500">
          {property.city}, {property.state} {property.zip} · {property.county} County
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <PropertyDetailsSection
          key={property.updatedAt.toISOString()}
          propertyId={propertyId}
          streetAddress={property.streetAddress}
          city={property.city}
          state={property.state}
          zip={property.zip}
          county={property.county}
          parcelNumber={property.parcelNumber}
          propertyType={property.propertyType}
          insuranceCarrierVendorId={property.insuranceCarrierVendorId}
          vendorOptions={vendorOptions}
          insuranceLastBillAmountCents={property.insuranceLastBillAmountCents}
          insuranceLastBillDate={property.insuranceLastBillDate}
          winterTaxLastBillAmountCents={property.winterTaxLastBillAmountCents}
          winterTaxLastBillDate={property.winterTaxLastBillDate}
          summerTaxLastBillAmountCents={property.summerTaxLastBillAmountCents}
          summerTaxLastBillDate={property.summerTaxLastBillDate}
        />

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 shadow-sm p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Land Contracts</h3>
            {propertyContracts.length === 0 ? (
              <p className="text-sm text-slate-400">No land contract on file for this property yet.</p>
            ) : (
              <ul className="space-y-3">
                {propertyContracts.map((c) => (
                  <li key={c.id} className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
                    <Link href={`/contracts/${c.id}`} prefetch={false} className="font-medium text-blue-700 hover:underline">
                      {c.contractNumber}
                    </Link>
                    <p className="text-sm text-slate-500">
                      {c.status} · {formatCents(c.currentPrincipalBalanceCents)} balance
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Borrower:{" "}
                      {(buyersByContract.get(c.id) ?? []).length === 0
                        ? "—"
                        : (buyersByContract.get(c.id) ?? []).map((b, i) => (
                            <span key={b.partyId}>
                              {i > 0 && ", "}
                              <Link href={`/borrowers/${b.partyId}`} prefetch={false} className="text-blue-700 hover:underline">
                                {b.displayName}
                              </Link>
                            </span>
                          ))}
                    </p>
                    <p className="text-sm text-slate-600">
                      Lender:{" "}
                      {(lendersByContract.get(c.id) ?? []).length === 0
                        ? "—"
                        : (lendersByContract.get(c.id) ?? []).map((l, i) => (
                            <span key={l.partyId}>
                              {i > 0 && ", "}
                              <Link href={`/lenders/${l.partyId}`} prefetch={false} className="text-blue-700 hover:underline">
                                {l.displayName}
                              </Link>
                            </span>
                          ))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <AssessorDataCard
            propertyId={propertyId}
            snapshot={
              latestAssessorSnapshot
                ? {
                    fetchedAt: latestAssessorSnapshot.fetchedAt.toISOString(),
                    county: latestAssessorSnapshot.county,
                    apn: latestAssessorSnapshot.apn,
                    ownerFullName: latestAssessorSnapshot.ownerFullName,
                    assessedValueCents: latestAssessorSnapshot.assessedValueCents,
                    estimatedMarketValueCents: latestAssessorSnapshot.estimatedMarketValueCents,
                    annualTaxAmountCents: latestAssessorSnapshot.annualTaxAmountCents,
                    taxYear: latestAssessorSnapshot.taxYear,
                    isTaxExemption: latestAssessorSnapshot.isTaxExemption,
                    exemptionType: latestAssessorSnapshot.exemptionType,
                    lastSaleDate: latestAssessorSnapshot.lastSaleDate,
                    lastSaleAmountCents: latestAssessorSnapshot.lastSaleAmountCents,
                    isListed: latestAssessorSnapshot.isListed,
                    isListedDate: latestAssessorSnapshot.isListedDate,
                    yearBuilt: latestAssessorSnapshot.yearBuilt,
                    beds: latestAssessorSnapshot.beds,
                    baths: latestAssessorSnapshot.baths,
                    sqft: latestAssessorSnapshot.sqft,
                    legalDescription: latestAssessorSnapshot.legalDescription,
                  }
                : null
            }
          />
        </div>
      </div>
    </main>
  );
}
