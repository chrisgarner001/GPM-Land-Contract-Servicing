import Link from "next/link";
import { Users } from "lucide-react";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts, contractParties } from "@/db/schema/contracts";
import { parties, properties } from "@/db/schema/parties";
import LogInAsButton from "./_components/LogInAsButton";

async function getBorrowers() {
  return db
    .select({
      contractId: contracts.id,
      contractNumber: contracts.contractNumber,
      status: contracts.status,
      inBankruptcy: contracts.inBankruptcy,
      borrowerPortalPin: contracts.borrowerPortalPin,
      borrowerPortalEmail: contracts.borrowerPortalEmail,
      borrowerPortalDeactivated: contracts.borrowerPortalDeactivated,
      partyId: parties.id,
      buyerName: parties.displayName,
      phone: parties.phone,
      streetAddress: properties.streetAddress,
      city: properties.city,
      state: properties.state,
    })
    .from(contracts)
    .innerJoin(
      contractParties,
      and(eq(contractParties.contractId, contracts.id), eq(contractParties.role, "BUYER"))
    )
    .innerJoin(parties, eq(contractParties.partyId, parties.id))
    .leftJoin(properties, eq(contracts.propertyId, properties.id))
    .orderBy(contracts.contractNumber);
}

export default async function BorrowersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const qLower = q.toLowerCase();
  const status = params.status === "PAID_OFF" ? "PAID_OFF" : "ACTIVE";

  const allRows = await getBorrowers();
  const statusRows = allRows.filter((row) => row.status === status);
  const rows = qLower
    ? statusRows.filter((row) =>
        [row.contractNumber, row.buyerName, row.streetAddress, row.city, row.phone, row.borrowerPortalEmail]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(qLower)
      )
    : statusRows;

  const otherStatus = status === "ACTIVE" ? "PAID_OFF" : "ACTIVE";
  const otherStatusHref = `/borrowers?status=${otherStatus}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
          <Users size={20} className="text-slate-400" aria-hidden="true" />
          Borrowers
        </h1>
        <Link
          href={otherStatusHref}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {status === "ACTIVE" ? "Show Paid Off" : "Show Active"}
        </Link>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        {rows.length} of {statusRows.length} {status === "ACTIVE" ? "active" : "paid off"} borrowers
      </p>

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        {status !== "ACTIVE" && <input type="hidden" name="status" value={status} />}
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search account, borrower, property, phone, email..."
          className="w-80 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Search
        </button>
        {q && (
          <Link href={`/borrowers${status !== "ACTIVE" ? `?status=${status}` : ""}`} className="text-sm text-slate-500 hover:underline">
            Clear
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Borrower</th>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Online Portal</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.contractId} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/contracts/${row.contractId}`} prefetch={false} className="font-medium text-blue-700 hover:underline">
                    {row.contractNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/borrowers/${row.partyId}`} prefetch={false} className="font-medium text-blue-700 hover:underline">
                    {row.buyerName}
                  </Link>
                  {row.inBankruptcy && (
                    <span className="ml-1.5 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800 ring-1 ring-inset ring-red-700/30">
                      Bankruptcy
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {row.streetAddress ? `${row.streetAddress}, ${row.city}, ${row.state}` : "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">{row.phone ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">
                  {row.borrowerPortalEmail ? (
                    <Link href={`/borrowers/${row.partyId}#compose-email`} className="text-blue-700 hover:underline">
                      {row.borrowerPortalEmail}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.borrowerPortalDeactivated ? (
                    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                      Deactivated
                    </span>
                  ) : row.borrowerPortalEmail && row.borrowerPortalPin ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        Active
                      </span>
                      <LogInAsButton contractId={row.contractId} />
                    </div>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-500/20">
                      Not Set Up
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
