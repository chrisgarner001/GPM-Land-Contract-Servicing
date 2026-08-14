import { eq, asc, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { payments, paymentAllocations } from "@/db/schema/payments";
import { formatCents, formatDate } from "@/lib/format";

function sumByType(allocations: { allocationType: string; amountCents: number }[], ...types: string[]): number {
  return allocations.filter((a) => types.includes(a.allocationType)).reduce((s, a) => s + a.amountCents, 0);
}

export default async function ContractHistoryPage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params;

  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.contractId, contractId))
    .orderBy(asc(payments.receivedDate));

  const paymentIds = paymentRows.map((p) => p.id);
  const allocationRows =
    paymentIds.length > 0 ? await db.select().from(paymentAllocations).where(inArray(paymentAllocations.paymentId, paymentIds)) : [];

  const allocationsByPayment = new Map<string, typeof allocationRows>();
  for (const a of allocationRows) {
    if (!allocationsByPayment.has(a.paymentId)) allocationsByPayment.set(a.paymentId, []);
    allocationsByPayment.get(a.paymentId)!.push(a);
  }

  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Loan History</h3>
      {paymentRows.length === 0 ? (
        <p className="text-sm text-slate-400">No payments recorded.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4">Date Received</th>
                <th className="py-2 pr-4">Reference</th>
                <th className="py-2 pr-4">Description</th>
                <th className="py-2 pr-4 text-right">Principal</th>
                <th className="py-2 pr-4 text-right">Interest</th>
                <th className="py-2 pr-4 text-right">Escrow</th>
                <th className="py-2 pr-4 text-right">Charges</th>
                <th className="py-2 pr-4 text-right">Late Fee</th>
                <th className="py-2 pr-4 text-right">Total Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paymentRows.map((p) => {
                const allocs = allocationsByPayment.get(p.id) ?? [];
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-1.5 pr-4 text-slate-600">{formatDate(p.receivedDate)}</td>
                    <td className="py-1.5 pr-4 text-slate-400">{p.referenceNumber ?? "—"}</td>
                    <td className="py-1.5 pr-4 text-slate-600">
                      {p.legacyDescription ?? "Payment"}
                      {p.status === "REVERSED" && (
                        <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Reversed</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-4 text-right tabular-nums text-slate-700">
                      {formatCents(sumByType(allocs, "PRINCIPAL"))}
                    </td>
                    <td className="py-1.5 pr-4 text-right tabular-nums text-slate-700">
                      {formatCents(sumByType(allocs, "INTEREST"))}
                    </td>
                    <td className="py-1.5 pr-4 text-right tabular-nums text-slate-700">
                      {formatCents(sumByType(allocs, "ESCROW_TAX", "ESCROW_INSURANCE"))}
                    </td>
                    <td className="py-1.5 pr-4 text-right tabular-nums text-slate-700">
                      {formatCents(sumByType(allocs, "OTHER_FEE"))}
                    </td>
                    <td className="py-1.5 pr-4 text-right tabular-nums text-slate-700">
                      {formatCents(sumByType(allocs, "LATE_FEE"))}
                    </td>
                    <td className="py-1.5 pr-4 text-right tabular-nums font-medium text-slate-900">
                      {formatCents(p.amountCents)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
