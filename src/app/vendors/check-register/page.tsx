import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { and, asc, desc, eq, gte, lte, or, ilike, not, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { checks, checkLineItems } from "@/db/schema/checks";
import { contracts } from "@/db/schema/contracts";
import { formatCents, formatDate } from "@/lib/format";
import { isLenderPayeeSql } from "@/server/checkClassification";

const SORT_OPTIONS = {
  date: checks.checkDate,
  checkNumber: checks.checkNumber,
  payee: checks.payeeName,
  loanAccount: contracts.contractNumber,
  amount: checkLineItems.amountCents,
} as const;

type SortKey = keyof typeof SORT_OPTIONS;

function daysAgoIso(days: number): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - days);
  return now.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function SortHeader({
  label,
  sortKeyValue,
  align,
  currentSort,
  currentDir,
  buildHref,
}: {
  label: string;
  sortKeyValue: SortKey;
  align?: "right";
  currentSort: SortKey;
  currentDir: "asc" | "desc";
  buildHref: (overrides: Partial<Record<"sort" | "dir", string>>) => string;
}) {
  const isActive = currentSort === sortKeyValue;
  const nextDir = isActive && currentDir === "desc" ? "asc" : "desc";
  return (
    <th className={`px-4 py-3 ${align === "right" ? "text-right" : ""}`}>
      <Link href={buildHref({ sort: sortKeyValue, dir: nextDir })} className="inline-flex items-center gap-1 hover:text-slate-900">
        {label}
        {isActive && <span>{currentDir === "asc" ? "▲" : "▼"}</span>}
      </Link>
    </th>
  );
}

export default async function CheckRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    payee?: string;
    loanAccount?: string;
    sort?: string;
    dir?: string;
    all?: string;
  }>;
}) {
  const params = await searchParams;
  const hasAnyFilterParam = Boolean(params.startDate || params.endDate || params.payee || params.loanAccount || params.all);

  const startDate = params.startDate ?? (hasAnyFilterParam ? undefined : daysAgoIso(90));
  const endDate = params.endDate ?? (hasAnyFilterParam ? undefined : todayIso());
  const payee = params.payee?.trim() ?? "";
  const loanAccount = params.loanAccount?.trim() ?? "";
  const sortKey: SortKey = params.sort && params.sort in SORT_OPTIONS ? (params.sort as SortKey) : "date";
  const sortDir: "asc" | "desc" = params.dir === "asc" ? "asc" : "desc";

  // TMO's Check Register mixes vendor and lender payees in one report —
  // excluded here so this page shows only vendor payments; see
  // /lenders/check-register for the lender side of the same underlying data.
  const conditions: (SQL | undefined)[] = [not(isLenderPayeeSql)];
  if (startDate) conditions.push(gte(checks.checkDate, startDate));
  if (endDate) conditions.push(lte(checks.checkDate, endDate));
  if (payee) conditions.push(or(ilike(checks.payeeName, `%${payee}%`), ilike(checks.payeeCode, `%${payee}%`)));
  if (loanAccount) conditions.push(ilike(contracts.contractNumber, `%${loanAccount}%`));

  const sortColumn = SORT_OPTIONS[sortKey];
  const orderBy = sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);

  const rows = await db
    .select({
      lineItemId: checkLineItems.id,
      checkNumber: checks.checkNumber,
      checkDate: checks.checkDate,
      payeeCode: checks.payeeCode,
      payeeName: checks.payeeName,
      loanAccountRaw: checkLineItems.loanAccountRaw,
      contractId: contracts.id,
      contractNumber: contracts.contractNumber,
      amountCents: checkLineItems.amountCents,
      servicingFeeCents: checkLineItems.servicingFeeCents,
      interestCents: checkLineItems.interestCents,
      principalCents: checkLineItems.principalCents,
    })
    .from(checkLineItems)
    .innerJoin(checks, eq(checkLineItems.checkId, checks.id))
    .leftJoin(contracts, eq(checkLineItems.contractId, contracts.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderBy, desc(checks.checkNumber))
    .limit(1000);

  const totalCents = rows.reduce((s, r) => s + r.amountCents, 0);

  const buildHref = (overrides: Partial<Record<"startDate" | "endDate" | "payee" | "loanAccount" | "sort" | "dir" | "all", string>>) => {
    const next = new URLSearchParams();
    const v = {
      startDate: overrides.startDate ?? startDate ?? "",
      endDate: overrides.endDate ?? endDate ?? "",
      payee: overrides.payee ?? payee,
      loanAccount: overrides.loanAccount ?? loanAccount,
      sort: overrides.sort ?? sortKey,
      dir: overrides.dir ?? sortDir,
      all: overrides.all ?? params.all ?? "",
    };
    if (v.startDate) next.set("startDate", v.startDate);
    if (v.endDate) next.set("endDate", v.endDate);
    if (v.payee) next.set("payee", v.payee);
    if (v.loanAccount) next.set("loanAccount", v.loanAccount);
    if (v.sort !== "date") next.set("sort", v.sort);
    if (v.dir !== "desc") next.set("dir", v.dir);
    if (v.all) next.set("all", v.all);
    const qs = next.toString();
    return qs ? `/vendors/check-register?${qs}` : "/vendors/check-register";
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="mb-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
        <ClipboardList size={20} className="text-slate-400" aria-hidden="true" />
        Check Register
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        {rows.length} line items{rows.length === 1000 ? " (capped at 1000 — narrow your filters to see more precisely)" : ""} · Total:{" "}
        {formatCents(totalCents)}
        {!hasAnyFilterParam && " · Showing the last 90 days by default"}
      </p>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        {sortKey !== "date" && <input type="hidden" name="sort" value={sortKey} />}
        {sortDir !== "desc" && <input type="hidden" name="dir" value={sortDir} />}
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="startDate">
            Start Date
          </label>
          <input
            id="startDate"
            type="date"
            name="startDate"
            defaultValue={startDate}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="endDate">
            End Date
          </label>
          <input
            id="endDate"
            type="date"
            name="endDate"
            defaultValue={endDate}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="payee">
            Vendor / Payee
          </label>
          <input
            id="payee"
            type="text"
            name="payee"
            defaultValue={payee}
            placeholder="Name or code"
            className="w-48 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="loanAccount">
            Land Contract #
          </label>
          <input
            id="loanAccount"
            type="text"
            name="loanAccount"
            defaultValue={loanAccount}
            placeholder="e.g. TMO-00042"
            className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
          Filter
        </button>
        <Link href={buildHref({ startDate: "", endDate: "", payee: "", loanAccount: "", all: "1" })} className="text-sm text-slate-500 hover:underline">
          Show All (no date limit)
        </Link>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <SortHeader label="Date" sortKeyValue="date" currentSort={sortKey} currentDir={sortDir} buildHref={buildHref} />
              <SortHeader label="Check #" sortKeyValue="checkNumber" currentSort={sortKey} currentDir={sortDir} buildHref={buildHref} />
              <SortHeader label="Payee" sortKeyValue="payee" currentSort={sortKey} currentDir={sortDir} buildHref={buildHref} />
              <SortHeader label="Land Contract" sortKeyValue="loanAccount" currentSort={sortKey} currentDir={sortDir} buildHref={buildHref} />
              <SortHeader label="Amount" sortKeyValue="amount" align="right" currentSort={sortKey} currentDir={sortDir} buildHref={buildHref} />
              <th className="px-4 py-3 text-right">Serv. Fee</th>
              <th className="px-4 py-3 text-right">Interest</th>
              <th className="px-4 py-3 text-right">Principal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.lineItemId} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{formatDate(row.checkDate)}</td>
                <td className="px-4 py-3 text-slate-500">{row.checkNumber}</td>
                <td className="px-4 py-3 text-slate-700">
                  {row.payeeName}
                  <span className="ml-1 text-xs text-slate-400">({row.payeeCode})</span>
                </td>
                <td className="px-4 py-3">
                  {row.contractId ? (
                    <Link href={`/contracts/${row.contractId}`} prefetch={false} className="font-medium text-blue-700 hover:underline">
                      {row.contractNumber}
                    </Link>
                  ) : (
                    <span className="text-slate-400">{row.loanAccountRaw ?? "—"}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">{formatCents(row.amountCents)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-500">{formatCents(row.servicingFeeCents)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-500">{formatCents(row.interestCents)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-500">{formatCents(row.principalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
