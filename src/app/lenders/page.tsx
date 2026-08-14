import Link from "next/link";
import { Landmark } from "lucide-react";
import { eq, gt, sum, countDistinct, and, notExists, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { parties } from "@/db/schema/parties";
import { contractParties } from "@/db/schema/contracts";
import { lenderLedgerEntries } from "@/db/schema/lending";
import { formatCents } from "@/lib/format";
import LogInAsButton from "./_components/LogInAsButton";

async function getLenders() {
  const rows = await db
    .select({
      id: parties.id,
      displayName: parties.displayName,
      email: parties.email,
      portalPin: parties.portalPin,
      portalDeactivated: parties.portalDeactivated,
      contractsFunded: countDistinct(contractParties.contractId),
    })
    .from(parties)
    // Left join — a lender just added via "Add New Lender" isn't funding
    // anything yet, but should still show up here (previously an inner join
    // silently hid them, which looked exactly like the record hadn't saved
    // at all). Only the active-funding rows count toward "Contracts Funded".
    .leftJoin(
      contractParties,
      and(eq(contractParties.partyId, parties.id), eq(contractParties.role, "INVESTOR_PAYEE"), gt(contractParties.ownershipPercent, "0"))
    )
    // Excludes borrowers/sellers — a party only belongs on this list if it's
    // never held one of their roles. A never-funded "Add New Lender" party
    // (zero contract_parties rows at all) still passes this, same as a past
    // lender whose funding has since closed out (ownershipPercent = 0).
    .where(
      notExists(
        db
          .select({ id: contractParties.id })
          .from(contractParties)
          .where(and(eq(contractParties.partyId, parties.id), inArray(contractParties.role, ["BUYER", "CO_BUYER", "SELLER", "CO_SELLER"])))
      )
    )
    .groupBy(parties.id)
    .orderBy(parties.displayName);

  const ledgerTotals = await db
    .select({
      lenderPartyId: lenderLedgerEntries.lenderPartyId,
      netCents: sum(lenderLedgerEntries.amountReceivedCents),
      paidOutCents: sum(lenderLedgerEntries.amountPaidOutCents),
    })
    .from(lenderLedgerEntries)
    .groupBy(lenderLedgerEntries.lenderPartyId);

  const totalsById = new Map(
    ledgerTotals.map((t) => [t.lenderPartyId, Number(t.netCents ?? 0) - Number(t.paidOutCents ?? 0)])
  );

  return rows.map((r) => ({ ...r, totalActivityCents: totalsById.get(r.id) ?? 0 }));
}

function buildHref(params: { q: string; dir: "asc" | "desc" }): string {
  const next = new URLSearchParams();
  if (params.q) next.set("q", params.q);
  if (params.dir !== "asc") next.set("dir", params.dir);
  const qs = next.toString();
  return qs ? `/lenders?${qs}` : "/lenders";
}

export default async function LendersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dir?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const qLower = q.toLowerCase();
  const dir: "asc" | "desc" = params.dir === "desc" ? "desc" : "asc";

  const allRows = await getLenders();
  let rows = qLower
    ? allRows.filter((row) => [row.displayName, row.email].filter(Boolean).join(" ").toLowerCase().includes(qLower))
    : allRows;

  rows = [...rows].sort((a, b) => {
    const cmp = a.displayName.localeCompare(b.displayName);
    return dir === "asc" ? cmp : -cmp;
  });

  const nextDir = dir === "asc" ? "desc" : "asc";

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
        <Landmark size={20} className="text-slate-400" aria-hidden="true" />
        Lenders
      </h1>
      <p className="mb-4 text-sm text-slate-500">
        {rows.length} of {allRows.length} lenders
      </p>

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        {dir !== "asc" && <input type="hidden" name="dir" value={dir} />}
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search lender name or email..."
          className="w-80 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Search
        </button>
        {q && (
          <Link href={buildHref({ q: "", dir })} className="text-sm text-slate-500 hover:underline">
            Clear
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">
                <Link href={buildHref({ q, dir: nextDir })} className="inline-flex items-center gap-1 hover:text-slate-900">
                  Lender
                  <span>{dir === "asc" ? "▲" : "▼"}</span>
                </Link>
              </th>
              <th className="w-64 px-4 py-3">Email</th>
              <th className="px-4 py-3">Online Portal</th>
              <th className="px-4 py-3 text-right">Contracts Funded</th>
              <th className="px-4 py-3 text-right">Total Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/lenders/${row.id}`} prefetch={false} className="font-medium text-blue-700 hover:underline">
                    {row.displayName}
                  </Link>
                </td>
                <td className="w-64 px-4 py-3 text-slate-500">
                  {row.email
                    ? row.email.split(",").map((addr) => (
                        <div key={addr} className="truncate" title={addr.trim()}>
                          <Link href={`/lenders/${row.id}#compose-email`} className="text-blue-700 hover:underline">
                            {addr.trim()}
                          </Link>
                        </div>
                      ))
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {row.portalDeactivated ? (
                    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                      Deactivated
                    </span>
                  ) : row.email && row.portalPin ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        Active
                      </span>
                      <LogInAsButton lenderId={row.id} />
                    </div>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-500/20">
                      Not Set Up
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">{row.contractsFunded}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                  {formatCents(row.totalActivityCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
