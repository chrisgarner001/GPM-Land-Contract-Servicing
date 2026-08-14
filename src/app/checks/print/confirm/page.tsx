import Link from "next/link";
import { db } from "@/db/client";
import { checks } from "@/db/schema/checks";
import { inArray } from "drizzle-orm";
import { formatCents, formatDate } from "@/lib/format";
import { confirmPrintedAction } from "./actions";

export default async function ConfirmPrintedPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string | string[]; returnTo?: string }>;
}) {
  const params = await searchParams;
  // Accepts either a single comma-joined value (vendor flow, built
  // programmatically after check creation) or repeated ids= query params
  // (lender flow's plain GET-form checkbox list).
  const idsParam = params.ids;
  const ids = Array.isArray(idsParam)
    ? idsParam.flatMap((v) => v.split(",")).filter(Boolean)
    : (idsParam?.split(",").filter(Boolean) ?? []);
  const returnTo = params.returnTo || "/";

  const rows = ids.length > 0 ? await db.select().from(checks).where(inArray(checks.id, ids)) : [];
  const totalCents = rows.reduce((s, r) => s + r.totalAmountCents, 0);

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <Link href={returnTo} className="text-sm font-medium text-blue-700 hover:underline">
        ← Back
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold text-slate-900">Print &amp; Confirm</h1>
      <p className="mb-4 text-sm text-slate-500">
        Load the check stock, then print. Only confirm below once the checks came out correctly — this is what marks
        them as printed.
      </p>

      <a
        href={`/checks/print?ids=${ids.join(",")}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-6 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Open PDF to Print
      </a>

      <div className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2">Check #</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Payee</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 text-slate-500">{r.checkNumber}</td>
                <td className="px-4 py-2 text-slate-600">{formatDate(r.checkDate)}</td>
                <td className="px-4 py-2 text-slate-700">{r.payeeName}</td>
                <td className="px-4 py-2 text-right tabular-nums font-medium text-slate-900">{formatCents(r.totalAmountCents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-semibold text-slate-900">
              <td className="px-4 py-2" colSpan={3}>
                Total
              </td>
              <td className="px-4 py-2 text-right">{formatCents(totalCents)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <form action={confirmPrintedAction}>
        <input type="hidden" name="ids" value={ids.join(",")} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button type="submit" className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
          Confirm Printed Successfully
        </button>
      </form>
    </main>
  );
}
