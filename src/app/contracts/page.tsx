import Link from "next/link";
import { FileText } from "lucide-react";
import { eq, and, gt, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts, contractParties } from "@/db/schema/contracts";
import { parties, properties } from "@/db/schema/parties";
import { formatCents, formatDate, formatPercent } from "@/lib/format";

type Row = {
  id: string;
  contractNumber: string;
  status: string;
  legalProcessStage: string | null;
  inBankruptcy: boolean;
  currentPrincipalBalanceCents: number;
  paymentAmountCents: number;
  interestRateAnnual: string;
  maturityDate: string | null;
  nextPaymentDate: string | null;
  propertyId: string | null;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  buyerPartyId: string | null;
  buyerName: string | null;
};

const SORT_COLUMNS = {
  account: (r: Row) => r.contractNumber,
  borrower: (r: Row) => r.buyerName ?? "",
  lender: (r: Row, lenders: Map<string, string>) => lenders.get(r.id) ?? "",
  property: (r: Row) => r.streetAddress ?? "",
  status: (r: Row) => r.status,
  rate: (r: Row) => Number(r.interestRateAnnual),
  payment: (r: Row) => r.paymentAmountCents,
  balance: (r: Row) => r.currentPrincipalBalanceCents,
  maturity: (r: Row) => r.maturityDate ?? "",
  nextDue: (r: Row) => r.nextPaymentDate ?? "",
  daysPastDue: (r: Row) => (r.status === "ACTIVE" ? daysPastDue(r.nextPaymentDate) : 0),
} as const;

type SortKey = keyof typeof SORT_COLUMNS;

async function getContracts(showAll: boolean): Promise<Row[]> {
  return db
    .select({
      id: contracts.id,
      contractNumber: contracts.contractNumber,
      status: contracts.status,
      legalProcessStage: contracts.legalProcessStage,
      inBankruptcy: contracts.inBankruptcy,
      currentPrincipalBalanceCents: contracts.currentPrincipalBalanceCents,
      paymentAmountCents: contracts.paymentAmountCents,
      interestRateAnnual: contracts.interestRateAnnual,
      maturityDate: contracts.maturityDate,
      nextPaymentDate: contracts.nextPaymentDate,
      propertyId: contracts.propertyId,
      streetAddress: properties.streetAddress,
      city: properties.city,
      state: properties.state,
      buyerPartyId: parties.id,
      buyerName: parties.displayName,
    })
    .from(contracts)
    .leftJoin(properties, eq(contracts.propertyId, properties.id))
    .leftJoin(contractParties, and(eq(contractParties.contractId, contracts.id), eq(contractParties.role, "BUYER")))
    .leftJoin(parties, eq(contractParties.partyId, parties.id))
    .where(showAll ? undefined : eq(contracts.status, "ACTIVE"))
    .orderBy(contracts.contractNumber);
}

// Fetched separately (not joined into getContracts) because a contract can
// have more than one current lender (split funding) — joining would fan out
// the row count the same way the buyer join once did (see the parser fix
// that resolved the "945 contracts" bug).
async function getCurrentLendersByContract(contractIds: string[]): Promise<Map<string, { id: string; displayName: string }[]>> {
  if (contractIds.length === 0) return new Map();
  const rows = await db
    .select({ contractId: contractParties.contractId, id: parties.id, displayName: parties.displayName })
    .from(contractParties)
    .innerJoin(parties, eq(contractParties.partyId, parties.id))
    .where(
      and(
        inArray(contractParties.contractId, contractIds),
        eq(contractParties.role, "INVESTOR_PAYEE"),
        gt(contractParties.ownershipPercent, "0")
      )
    );

  const byContract = new Map<string, { id: string; displayName: string }[]>();
  for (const r of rows) {
    if (!byContract.has(r.contractId)) byContract.set(r.contractId, []);
    byContract.get(r.contractId)!.push({ id: r.id, displayName: r.displayName });
  }
  return byContract;
}

function daysPastDue(nextPaymentDate: string | null): number {
  if (!nextPaymentDate) return 0;
  const due = new Date(`${nextPaymentDate}T00:00:00Z`);
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.max(0, Math.floor((todayUtc.getTime() - due.getTime()) / 86_400_000));
}

// Only ACTIVE contracts are shaded — a paid-off/cancelled contract with a
// stale next-payment-date in the past isn't actually delinquent.
function delinquencyRowClass(row: Row): string {
  if (row.status !== "ACTIVE") return "";
  const days = daysPastDue(row.nextPaymentDate);
  if (days >= 90) return "bg-red-50";
  if (days >= 60) return "bg-yellow-50";
  if (days >= 30) return "bg-blue-50";
  return "";
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    PAID_OFF: "bg-slate-100 text-slate-600 ring-slate-500/20",
    DEFAULTED: "bg-red-50 text-red-700 ring-red-600/20",
    IN_FORECLOSURE: "bg-red-50 text-red-700 ring-red-600/20",
    CANCELLED: "bg-slate-100 text-slate-500 ring-slate-500/20",
  };
  const label: Record<string, string> = {
    ACTIVE: "Active",
    PAID_OFF: "Paid Off",
    DEFAULTED: "Defaulted",
    IN_FORECLOSURE: "In Foreclosure",
    CANCELLED: "Cancelled",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status] ?? "bg-slate-100 text-slate-600 ring-slate-500/20"}`}>
      {label[status] ?? status}
    </span>
  );
}

const LEGAL_PROCESS_STAGE_STYLES: Record<string, string> = {
  COURT: "bg-orange-50 text-orange-700 ring-orange-600/20",
  FORECLOSED: "bg-red-100 text-red-800 ring-red-700/30",
  FORFEITED: "bg-purple-50 text-purple-700 ring-purple-600/20",
};
const LEGAL_PROCESS_STAGE_LABEL: Record<string, string> = {
  COURT: "Court",
  FORECLOSED: "Foreclosed",
  FORFEITED: "Forfeited",
};

function LegalProcessBadge({ stage }: { stage: string | null }) {
  if (!stage) return null;
  return (
    <span
      className={`ml-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        LEGAL_PROCESS_STAGE_STYLES[stage] ?? "bg-slate-100 text-slate-600 ring-slate-500/20"
      }`}
    >
      {LEGAL_PROCESS_STAGE_LABEL[stage] ?? stage}
    </span>
  );
}

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

export default async function ContractsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; lender?: string; sort?: string; dir?: string; minDays?: string }>;
}) {
  const params = await searchParams;
  const showAll = params.status === "all";
  const q = params.q?.trim() ?? "";
  const lenderFilter = params.lender ?? "";
  const sortKey: SortKey = params.sort && params.sort in SORT_COLUMNS ? (params.sort as SortKey) : "account";
  const sortDir: "asc" | "desc" = params.dir === "desc" ? "desc" : "asc";
  const minDays = params.minDays ? Number(params.minDays) : 0;

  const allRows = await getContracts(showAll);
  const lendersByContract = await getCurrentLendersByContract(allRows.map((r) => r.id));
  const lenderNamesByContract = new Map([...lendersByContract.entries()].map(([id, ls]) => [id, ls.map((l) => l.displayName)]));
  const lenderDisplayByContract = new Map([...lenderNamesByContract.entries()].map(([id, names]) => [id, names.join(", ")]));

  const allLenderNames = [...new Set([...lenderNamesByContract.values()].flat())].sort();

  // Buckets are mutually exclusive (matching the row-shading tiers), not
  // minimum thresholds — otherwise every button's result was dominated by
  // the same worst-case 90+ contracts sorted to the top, making all three
  // buttons look identical.
  const qLower = q.toLowerCase();
  let rows = allRows.filter((r) => {
    if (minDays > 0) {
      const d = SORT_COLUMNS.daysPastDue(r);
      if (minDays === 90 && d < 90) return false;
      if (minDays === 60 && (d < 60 || d >= 90)) return false;
      if (minDays === 30 && (d < 30 || d >= 60)) return false;
    }
    if (lenderFilter && !(lenderNamesByContract.get(r.id) ?? []).includes(lenderFilter)) return false;
    if (!qLower) return true;
    const haystack = [r.contractNumber, r.buyerName, r.streetAddress, r.city, lenderDisplayByContract.get(r.id)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(qLower);
  });

  const getSortValue = SORT_COLUMNS[sortKey];
  const compareByCurrentSort = (a: Row, b: Row) => {
    const av = getSortValue(a, lenderDisplayByContract);
    const bv = getSortValue(b, lenderDisplayByContract);
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  };

  if (sortKey === "status") {
    // Contracts already in Court are the ones staff need to act on first —
    // group them ahead of everything else regardless of sort direction,
    // then sort each group by status normally.
    const courtRows = rows.filter((r) => r.legalProcessStage === "COURT");
    const otherRows = rows.filter((r) => r.legalProcessStage !== "COURT");
    rows = [...[...courtRows].sort(compareByCurrentSort), ...[...otherRows].sort(compareByCurrentSort)];
  } else {
    rows = [...rows].sort(compareByCurrentSort);
  }

  const buildHref = (overrides: {
    status?: string;
    q?: string;
    lender?: string;
    sort?: SortKey;
    dir?: "asc" | "desc";
    minDays?: number;
  }) => {
    const next = new URLSearchParams();
    const status = overrides.status ?? params.status;
    const nextQ = overrides.q ?? q;
    const nextLender = overrides.lender ?? lenderFilter;
    const nextSort = overrides.sort ?? sortKey;
    const nextDir = overrides.dir ?? sortDir;
    const nextMinDays = overrides.minDays ?? minDays;
    if (status) next.set("status", status);
    if (nextQ) next.set("q", nextQ);
    if (nextLender) next.set("lender", nextLender);
    if (nextSort !== "account") next.set("sort", nextSort);
    if (nextDir !== "asc") next.set("dir", nextDir);
    if (nextMinDays > 0) next.set("minDays", String(nextMinDays));
    const qs = next.toString();
    return qs ? `/contracts?${qs}` : "/contracts";
  };
  const sortHref = (sort: SortKey, dir: "asc" | "desc") => buildHref({ sort, dir });
  const delinquencyHref = (tier: number) =>
    minDays === tier ? buildHref({ minDays: 0, sort: "account", dir: "asc" }) : buildHref({ minDays: tier, sort: "daysPastDue", dir: "desc" });

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <FileText size={20} className="text-slate-400" aria-hidden="true" />
            Land Contracts
          </h1>
          <p className="text-sm text-slate-500">{rows.length} contracts</p>
        </div>
        <Link
          href={buildHref({ status: showAll ? undefined : "all" })}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {showAll ? "Show Active Only" : "Show Paid Off"}
        </Link>
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        {showAll && <input type="hidden" name="status" value="all" />}
        {sortKey !== "account" && <input type="hidden" name="sort" value={sortKey} />}
        {sortDir !== "asc" && <input type="hidden" name="dir" value={sortDir} />}
        {minDays > 0 && <input type="hidden" name="minDays" value={minDays} />}
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search account, borrower, property, lender..."
          className="w-72 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
        <select
          name="lender"
          defaultValue={lenderFilter}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">All lenders</option>
          {allLenderNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Filter
        </button>
        {(q || lenderFilter) && (
          <Link href={buildHref({ q: "", lender: "" })} className="text-sm text-slate-500 hover:underline">
            Clear
          </Link>
        )}
        <div className="ml-auto flex items-center gap-2 text-xs">
          <Link
            href={buildHref({ minDays: 0, sort: "account", dir: "asc" })}
            className={`flex items-center gap-1 rounded-full px-2 py-1 ring-1 ring-inset ${
              minDays === 0 ? "bg-slate-200 ring-slate-400 font-medium text-slate-900" : "bg-slate-50 text-slate-600 ring-slate-300 hover:bg-slate-100"
            }`}
          >
            All
          </Link>
          <Link
            href={delinquencyHref(30)}
            className={`flex items-center gap-1 rounded-full px-2 py-1 ring-1 ring-inset ${
              minDays === 30 ? "bg-blue-100 ring-blue-300 font-medium text-blue-900" : "bg-blue-50 text-slate-600 ring-blue-200 hover:bg-blue-100"
            }`}
          >
            <span className="h-3 w-3 rounded bg-blue-200" /> 30+ days
          </Link>
          <Link
            href={delinquencyHref(60)}
            className={`flex items-center gap-1 rounded-full px-2 py-1 ring-1 ring-inset ${
              minDays === 60 ? "bg-yellow-100 ring-yellow-300 font-medium text-yellow-900" : "bg-yellow-50 text-slate-600 ring-yellow-200 hover:bg-yellow-100"
            }`}
          >
            <span className="h-3 w-3 rounded bg-yellow-200" /> 60+ days
          </Link>
          <Link
            href={delinquencyHref(90)}
            className={`flex items-center gap-1 rounded-full px-2 py-1 ring-1 ring-inset ${
              minDays === 90 ? "bg-red-100 ring-red-300 font-medium text-red-900" : "bg-red-50 text-slate-600 ring-red-200 hover:bg-red-100"
            }`}
          >
            <span className="h-3 w-3 rounded bg-red-200" /> 90+ days
          </Link>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <SortHeader label="Account" sortKey="account" currentSort={sortKey} currentDir={sortDir} buildHref={sortHref} />
              <SortHeader label="Borrower" sortKey="borrower" currentSort={sortKey} currentDir={sortDir} buildHref={sortHref} />
              <SortHeader label="Lender" sortKey="lender" currentSort={sortKey} currentDir={sortDir} buildHref={sortHref} />
              <SortHeader label="Property" sortKey="property" currentSort={sortKey} currentDir={sortDir} buildHref={sortHref} />
              <SortHeader label="Status" sortKey="status" currentSort={sortKey} currentDir={sortDir} buildHref={sortHref} />
              <SortHeader label="Rate" sortKey="rate" align="right" currentSort={sortKey} currentDir={sortDir} buildHref={sortHref} />
              <SortHeader label="Regular Payment" sortKey="payment" align="right" currentSort={sortKey} currentDir={sortDir} buildHref={sortHref} />
              <SortHeader label="Principal Balance" sortKey="balance" align="right" currentSort={sortKey} currentDir={sortDir} buildHref={sortHref} />
              <SortHeader label="Maturity" sortKey="maturity" currentSort={sortKey} currentDir={sortDir} buildHref={sortHref} />
              <SortHeader label="Next Payment Due" sortKey="nextDue" currentSort={sortKey} currentDir={sortDir} buildHref={sortHref} />
              <SortHeader label="Days Past Due" sortKey="daysPastDue" align="right" currentSort={sortKey} currentDir={sortDir} buildHref={sortHref} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className={`hover:bg-slate-100 ${delinquencyRowClass(row)}`}>
                <td className="px-4 py-3">
                  <Link href={`/contracts/${row.id}`} prefetch={false} className="font-medium text-blue-700 hover:underline">
                    {row.contractNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {row.buyerName && row.buyerPartyId ? (
                    <Link href={`/borrowers/${row.buyerPartyId}`} prefetch={false} className="text-blue-700 hover:underline">
                      {row.buyerName}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {(lendersByContract.get(row.id) ?? []).length === 0
                    ? "—"
                    : (lendersByContract.get(row.id) ?? []).map((l, i) => (
                        <span key={l.id}>
                          {i > 0 && ", "}
                          <Link href={`/lenders/${l.id}`} prefetch={false} className="text-blue-700 hover:underline">
                            {l.displayName}
                          </Link>
                        </span>
                      ))}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {row.streetAddress && row.propertyId ? (
                    <Link href={`/properties/${row.propertyId}`} prefetch={false} className="text-blue-700 hover:underline">
                      {row.streetAddress}, {row.city}, {row.state}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                  <LegalProcessBadge stage={row.legalProcessStage} />
                  {row.inBankruptcy && (
                    <span className="ml-1 inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800 ring-1 ring-inset ring-red-700/30">
                      Bankruptcy
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatPercent(row.interestRateAnnual)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatCents(row.paymentAmountCents)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                  {formatCents(row.currentPrincipalBalanceCents)}
                </td>
                <td className="px-4 py-3 text-slate-500">{formatDate(row.maturityDate)}</td>
                <td className="px-4 py-3 text-slate-500">{formatDate(row.nextPaymentDate)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                  {row.status === "ACTIVE" && daysPastDue(row.nextPaymentDate) > 0 ? daysPastDue(row.nextPaymentDate) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
