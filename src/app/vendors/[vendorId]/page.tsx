import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { vendors, vendorDisbursements } from "@/db/schema/vendors";
import { contracts } from "@/db/schema/contracts";
import { bankAccounts, glCodes } from "@/db/schema/setup";
import { formatCents, formatDate } from "@/lib/format";
import DefaultBankAccountSection from "./_components/DefaultBankAccountSection";
import DefaultGlCodeSection from "./_components/DefaultGlCodeSection";

export default async function VendorDetailPage({ params }: { params: Promise<{ vendorId: string }> }) {
  const { vendorId } = await params;
  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId));
  if (!vendor) return null;

  const bankAccountOptions = await db.select({ id: bankAccounts.id, label: bankAccounts.label }).from(bankAccounts).orderBy(bankAccounts.label);
  const glCodeOptions = await db
    .select({ code: glCodes.code, description: glCodes.description, type: glCodes.type })
    .from(glCodes)
    .orderBy(glCodes.code);

  const disbursements = await db
    .select({
      id: vendorDisbursements.id,
      transactionDate: vendorDisbursements.transactionDate,
      reference: vendorDisbursements.reference,
      amountCents: vendorDisbursements.amountCents,
      servicingFeeCents: vendorDisbursements.servicingFeeCents,
      interestDistributionCents: vendorDisbursements.interestDistributionCents,
      principalDistributionCents: vendorDisbursements.principalDistributionCents,
      chargesCents: vendorDisbursements.chargesCents,
      otherCents: vendorDisbursements.otherCents,
      contractId: contracts.id,
      contractNumber: contracts.contractNumber,
    })
    .from(vendorDisbursements)
    .innerJoin(contracts, eq(vendorDisbursements.contractId, contracts.id))
    .where(eq(vendorDisbursements.vendorId, vendorId))
    .orderBy(desc(vendorDisbursements.transactionDate));

  const totalDisbursed = disbursements.reduce((s, d) => s + d.amountCents, 0);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex items-start justify-between">
        <Link href="/vendors" className="text-sm font-medium text-blue-700 hover:underline">
          ← All Vendors
        </Link>
        <Link
          href={`/vendors/new-invoice?vendorId=${vendorId}`}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New Invoice
        </Link>
      </div>

      <div className="mt-2 mb-6">
        <h1 className="text-xl font-semibold text-slate-900">{vendor.displayName}</h1>
        <p className="text-sm text-slate-500">
          Account #{vendor.vendorAccountCode}
          {vendor.referenceLine ? ` · ${vendor.referenceLine}` : ""}
        </p>
        {(vendor.addressLine1 || vendor.cityStateZip) && (
          <p className="text-sm text-slate-500">
            {vendor.addressLine1}
            {vendor.addressLine1 && vendor.cityStateZip ? ", " : ""}
            {vendor.cityStateZip}
          </p>
        )}
        <p className="mt-2 text-sm text-slate-700">
          {disbursements.length} transactions · Total Disbursed: <span className="font-medium">{formatCents(totalDisbursed)}</span>
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <DefaultBankAccountSection
          vendorId={vendorId}
          defaultBankAccountId={vendor.defaultBankAccountId}
          bankAccountOptions={bankAccountOptions}
        />
        <DefaultGlCodeSection vendorId={vendorId} defaultGlCode={vendor.defaultGlCode} glCodeOptions={glCodeOptions} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Land Contract</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Serv. Fee</th>
              <th className="px-4 py-3 text-right">Interest</th>
              <th className="px-4 py-3 text-right">Principal</th>
              <th className="px-4 py-3 text-right">Charges</th>
              <th className="px-4 py-3 text-right">Other</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {disbursements.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{formatDate(d.transactionDate)}</td>
                <td className="px-4 py-3 text-slate-400">{d.reference ?? "—"}</td>
                <td className="px-4 py-3">
                  <Link href={`/contracts/${d.contractId}`} prefetch={false} className="font-medium text-blue-700 hover:underline">
                    {d.contractNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">{formatCents(d.amountCents)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-500">{formatCents(d.servicingFeeCents)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-500">{formatCents(d.interestDistributionCents)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-500">{formatCents(d.principalDistributionCents)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-500">{formatCents(d.chargesCents)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-500">{formatCents(d.otherCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
