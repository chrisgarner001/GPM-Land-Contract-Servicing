import Link from "next/link";
import { Home } from "lucide-react";
import { eq, and, gt, isNull, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { properties } from "@/db/schema/parties";
import { contracts, contractParties } from "@/db/schema/contracts";
import { parties } from "@/db/schema/parties";
import { formatCents } from "@/lib/format";

const PROPERTY_TYPE_LABEL: Record<string, string> = {
  SINGLE_FAMILY: "SFR",
  MULTI_FAMILY: "Multi Family",
  COMMERCIAL: "Commercial",
  OTHER: "Other",
};

interface PropertyRow {
  id: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  propertyType: string | null;
  estimatedValueCents: number | null;
  contracts: { id: string; contractNumber: string }[];
  borrowerNames: string[];
  lenderNames: string[];
  hasActiveContract: boolean;
}

async function getProperties(): Promise<PropertyRow[]> {
  const allProperties = await db.select().from(properties).orderBy(properties.streetAddress);
  const propertyIds = allProperties.map((p) => p.id);

  const contractRows =
    propertyIds.length > 0
      ? await db
          .select({ propertyId: contracts.propertyId, id: contracts.id, contractNumber: contracts.contractNumber, status: contracts.status })
          .from(contracts)
          .where(inArray(contracts.propertyId, propertyIds))
      : [];
  const contractIds = contractRows.map((c) => c.id);

  const buyerRows =
    contractIds.length > 0
      ? await db
          .select({ contractId: contractParties.contractId, displayName: parties.displayName })
          .from(contractParties)
          .innerJoin(parties, eq(contractParties.partyId, parties.id))
          .where(and(inArray(contractParties.contractId, contractIds), eq(contractParties.role, "BUYER")))
      : [];

  const lenderRows =
    contractIds.length > 0
      ? await db
          .select({ contractId: contractParties.contractId, displayName: parties.displayName })
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

  const buyersByContract = new Map<string, string[]>();
  for (const r of buyerRows) {
    const list = buyersByContract.get(r.contractId) ?? [];
    list.push(r.displayName);
    buyersByContract.set(r.contractId, list);
  }
  const lendersByContract = new Map<string, string[]>();
  for (const r of lenderRows) {
    const list = lendersByContract.get(r.contractId) ?? [];
    list.push(r.displayName);
    lendersByContract.set(r.contractId, list);
  }

  const contractsByProperty = new Map<string, { id: string; contractNumber: string; status: string }[]>();
  for (const c of contractRows) {
    const list = contractsByProperty.get(c.propertyId) ?? [];
    list.push({ id: c.id, contractNumber: c.contractNumber, status: c.status });
    contractsByProperty.set(c.propertyId, list);
  }

  return allProperties.map((p) => {
    const propertyContracts = contractsByProperty.get(p.id) ?? [];
    const borrowerNames = [...new Set(propertyContracts.flatMap((c) => buyersByContract.get(c.id) ?? []))];
    const lenderNames = [...new Set(propertyContracts.flatMap((c) => lendersByContract.get(c.id) ?? []))];
    return {
      ...p,
      contracts: propertyContracts.map((c) => ({ id: c.id, contractNumber: c.contractNumber })),
      borrowerNames,
      lenderNames,
      hasActiveContract: propertyContracts.some((c) => c.status === "ACTIVE"),
    };
  });
}

const SORT_COLUMNS = {
  address: (r: PropertyRow) => r.streetAddress,
  county: (r: PropertyRow) => r.county,
  type: (r: PropertyRow) => (r.propertyType ? PROPERTY_TYPE_LABEL[r.propertyType] ?? r.propertyType : ""),
  value: (r: PropertyRow) => r.estimatedValueCents ?? -1,
  contract: (r: PropertyRow) => r.contracts.map((c) => c.contractNumber).join(", "),
  borrower: (r: PropertyRow) => r.borrowerNames.join(", "),
  lender: (r: PropertyRow) => r.lenderNames.join(", "),
} as const;

type SortKey = keyof typeof SORT_COLUMNS;

function SortHeader({
  label,
  sortKey,
  align,
  currentSort,
  currentDir,
  buildHref,
}: {
  label: string;
  sortKey: SortKey;
  align?: "right";
  currentSort: SortKey;
  currentDir: "asc" | "desc";
  buildHref: (sort: SortKey, dir: "asc" | "desc") => string;
}) {
  const isActive = currentSort === sortKey;
  const nextDir = isActive && currentDir === "asc" ? "desc" : "asc";
  return (
    <th className={`px-4 py-3 ${align === "right" ? "text-right" : ""}`}>
      <Link href={buildHref(sortKey, nextDir)} className="inline-flex items-center gap-1 hover:text-slate-900">
        {label}
        {isActive && <span>{currentDir === "asc" ? "▲" : "▼"}</span>}
      </Link>
    </th>
  );
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; all?: string; sort?: string; dir?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const qLower = q.toLowerCase();
  const showAll = params.all === "1";
  const sortKey: SortKey = params.sort && params.sort in SORT_COLUMNS ? (params.sort as SortKey) : "address";
  const sortDir: "asc" | "desc" = params.dir === "desc" ? "desc" : "asc";

  const allRows = await getProperties();
  const activeRows = showAll ? allRows : allRows.filter((r) => r.hasActiveContract);
  let rows = qLower
    ? activeRows.filter((r) =>
        [r.streetAddress, r.city, r.state, r.zip, r.county, ...r.borrowerNames, ...r.lenderNames, ...r.contracts.map((c) => c.contractNumber)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(qLower)
      )
    : activeRows;

  const getSortValue = SORT_COLUMNS[sortKey];
  rows = [...rows].sort((a, b) => {
    const av = getSortValue(a);
    const bv = getSortValue(b);
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const buildHref = (overrides: { q?: string; all?: boolean; sort?: SortKey; dir?: "asc" | "desc" }) => {
    const next = new URLSearchParams();
    const nextQ = overrides.q ?? q;
    const nextAll = overrides.all ?? showAll;
    const nextSort = overrides.sort ?? sortKey;
    const nextDir = overrides.dir ?? sortDir;
    if (nextQ) next.set("q", nextQ);
    if (nextAll) next.set("all", "1");
    if (nextSort !== "address") next.set("sort", nextSort);
    if (nextDir !== "asc") next.set("dir", nextDir);
    const qs = next.toString();
    return qs ? `/properties?${qs}` : "/properties";
  };
  const sortHref = (sort: SortKey, dir: "asc" | "desc") => buildHref({ sort, dir });

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <Home size={20} className="text-slate-400" aria-hidden="true" />
            Properties
          </h1>
          <p className="text-sm text-slate-500">
            {rows.length} of {allRows.length} {showAll ? "properties" : "active properties"}
          </p>
        </div>
        <Link
          href={buildHref({ all: !showAll })}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {showAll ? "Show Active Only" : "Show All"}
        </Link>
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        {showAll && <input type="hidden" name="all" value="1" />}
        {sortKey !== "address" && <input type="hidden" name="sort" value={sortKey} />}
        {sortDir !== "asc" && <input type="hidden" name="dir" value={sortDir} />}
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search address, county, borrower, lender, contract..."
          className="w-96 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
          Search
        </button>
        {q && (
          <Link href={buildHref({ q: "" })} className="text-sm text-slate-500 hover:underline">
            Clear
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <SortHeader label="Address" sortKey="address" currentSort={sortKey} currentDir={sortDir} buildHref={sortHref} />
              <SortHeader label="County" sortKey="county" currentSort={sortKey} currentDir={sortDir} buildHref={sortHref} />
              <SortHeader label="Type" sortKey="type" currentSort={sortKey} currentDir={sortDir} buildHref={sortHref} />
              <SortHeader label="Value" sortKey="value" align="right" currentSort={sortKey} currentDir={sortDir} buildHref={sortHref} />
              <SortHeader label="Land Contract" sortKey="contract" currentSort={sortKey} currentDir={sortDir} buildHref={sortHref} />
              <SortHeader label="Borrower" sortKey="borrower" currentSort={sortKey} currentDir={sortDir} buildHref={sortHref} />
              <SortHeader label="Lender" sortKey="lender" currentSort={sortKey} currentDir={sortDir} buildHref={sortHref} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  No properties found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/properties/${row.id}`} prefetch={false} className="font-medium text-blue-700 hover:underline">
                      {row.streetAddress}
                    </Link>
                    <div className="text-slate-500">
                      {row.city}, {row.state} {row.zip}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{row.county}</td>
                  <td className="px-4 py-3 text-slate-500">{row.propertyType ? PROPERTY_TYPE_LABEL[row.propertyType] ?? row.propertyType : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {row.estimatedValueCents !== null ? formatCents(row.estimatedValueCents) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {row.contracts.length === 0
                      ? "—"
                      : row.contracts.map((c, i) => (
                          <span key={c.id}>
                            {i > 0 && ", "}
                            <Link href={`/contracts/${c.id}`} prefetch={false} className="text-blue-700 hover:underline">
                              {c.contractNumber}
                            </Link>
                          </span>
                        ))}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.borrowerNames.join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{row.lenderNames.join(", ") || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
