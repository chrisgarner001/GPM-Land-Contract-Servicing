import { eq, asc } from "drizzle-orm";
import { db } from "@/db/client";
import { trustLedgerEntries } from "@/db/schema/escrow";
import { formatCents, formatDate } from "@/lib/format";

export default async function ContractTrustLedgerPage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params;

  const entries = await db
    .select()
    .from(trustLedgerEntries)
    .where(eq(trustLedgerEntries.contractId, contractId))
    .orderBy(asc(trustLedgerEntries.transactionDate));

  const reserveCount = entries.filter((e) => e.category === "RESERVE").length;
  const impoundCount = entries.filter((e) => e.category === "IMPOUND").length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Trust Ledger</h3>
        <div className="flex gap-3 text-xs text-slate-400">
          <span>{impoundCount} Impound</span>
          <span>{reserveCount} Reserve</span>
          <span>{entries.length - reserveCount - impoundCount} Unclassified</span>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-slate-400">No trust account activity recorded.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Reference</th>
                <th className="py-2 pr-4">From Whom Received / Paid</th>
                <th className="py-2 pr-4">Memo</th>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4 text-right">Payment</th>
                <th className="py-2 pr-4 text-right">Deposit</th>
                <th className="py-2 pr-4 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="py-1.5 pr-4 text-slate-600">{formatDate(e.transactionDate)}</td>
                  <td className="py-1.5 pr-4 text-slate-400">{e.reference ?? "—"}</td>
                  <td className="py-1.5 pr-4 text-slate-600">{e.payeeOrPayerName ?? "—"}</td>
                  <td className="py-1.5 pr-4 text-slate-500">{e.description ?? "—"}</td>
                  <td className="py-1.5 pr-4 text-slate-400">
                    {e.category === "IMPOUND" ? "Impound" : e.category === "RESERVE" ? "Reserve" : "—"}
                  </td>
                  <td className="py-1.5 pr-4 text-right tabular-nums text-red-700">
                    {e.amountPaidOutCents ? formatCents(e.amountPaidOutCents) : ""}
                  </td>
                  <td className="py-1.5 pr-4 text-right tabular-nums text-emerald-700">
                    {e.amountReceivedCents ? formatCents(e.amountReceivedCents) : ""}
                  </td>
                  <td className="py-1.5 pr-4 text-right tabular-nums font-medium text-slate-900">
                    {formatCents(e.balanceCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
