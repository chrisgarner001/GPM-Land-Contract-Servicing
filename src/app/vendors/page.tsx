import Link from "next/link";
import { Truck } from "lucide-react";
import { eq, sum, count } from "drizzle-orm";
import { db } from "@/db/client";
import { vendors, vendorDisbursements } from "@/db/schema/vendors";
import { formatCents } from "@/lib/format";

async function getVendors() {
  const rows = await db
    .select({
      id: vendors.id,
      vendorAccountCode: vendors.vendorAccountCode,
      displayName: vendors.displayName,
      cityStateZip: vendors.cityStateZip,
      deactivated: vendors.deactivated,
      totalDisbursedCents: sum(vendorDisbursements.amountCents),
      transactionCount: count(vendorDisbursements.id),
    })
    .from(vendors)
    .leftJoin(vendorDisbursements, eq(vendorDisbursements.vendorId, vendors.id))
    .groupBy(vendors.id)
    .orderBy(vendors.displayName);
  return rows;
}

export default async function VendorsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const showAll = params.status === "all";

  const allRows = await getVendors();
  const rows = showAll ? allRows : allRows.filter((row) => !row.deactivated);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
        <Truck size={20} className="text-slate-400" aria-hidden="true" />
        Vendors
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        {rows.length} of {allRows.length} vendors
        {!showAll && (
          <>
            {" — "}
            <Link href="/vendors?status=all" className="text-blue-700 hover:underline">
              Show Deactivated
            </Link>
          </>
        )}
        {showAll && (
          <>
            {" — "}
            <Link href="/vendors" className="text-blue-700 hover:underline">
              Hide Deactivated
            </Link>
          </>
        )}
      </p>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Account Code</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Transactions</th>
              <th className="px-4 py-3 text-right">Total Disbursed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/vendors/${row.id}`} prefetch={false} className="font-medium text-blue-700 hover:underline">
                    {row.displayName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-500">{row.vendorAccountCode}</td>
                <td className="px-4 py-3 text-slate-500">{row.cityStateZip ?? "—"}</td>
                <td className="px-4 py-3">
                  {row.deactivated ? (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-500/20">
                      Deactivated
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">{row.transactionCount}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                  {formatCents(Number(row.totalDisbursedCents ?? 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
