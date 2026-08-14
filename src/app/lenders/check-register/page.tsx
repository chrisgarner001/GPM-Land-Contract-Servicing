import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { and, asc, desc, eq, gte, lte, or, ilike, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { checks, checkLineItems } from "@/db/schema/checks";
import { contracts } from "@/db/schema/contracts";
import { formatCents, formatDate } from "@/lib/format";
import { isLenderPayeeSql } from "@/server/checkClassification";
import CheckRegisterRow from "./_components/CheckRegisterRow";

const SORT_OPTIONS = {
  date: checks.checkDate,
  checkNumber: checks.checkNumber,
  payee: checks.payeeName,
  amount: checks.totalAmountCents,
} as const;

type SortKey = keyof typeof SORT_OPTIONS;

const CHECK_CAP = 500;

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

export default async function LenderCheckRegisterPage({
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

  const startDate = params.startDate ?? (hasAnyFilterParam ? undefined : daysAgoIso(30));
  const endDate = params.endDate ?? (hasAnyFilterParam ? undefined : todayIso());
  const payee = params.payee?.trim() ?? "";
  const loanAccount = params.loanAccount?.trim() ?? "";
  const sortKey: SortKey = params.sort && params.sort in SORT_OPTIONS ? (params.sort as SortKey) : "date";
  const sortDir: "asc" | "desc" = params.dir === "asc" ? "asc" : "desc";

  // TMO's Check Register mixes vendor and lender payees in one report — this
  // page shows only lender payments; see /vendors/check-register for the
  // vendor side of the same underlying data.
  const conditions: (SQL | undefined)[] = [isLenderPayeeSql];
  if (startDate) conditions.push(gte(checks.checkDate, startDate));
  if (endDate) conditions.push(lte(checks.checkDate, endDate));
  if (payee) conditions.push(or(ilike(checks.payeeName, `%${payee}%`), ilike(checks.payeeCode, `%${payee}%`)));
  // Joined only to support this filter — a check matches if ANY of its line
  // items is for a matching contract; once matched, the whole check (every
  // line item, not just the matching one) is what gets shown/expanded.
  if (loanAccount) conditions.push(ilike(contracts.contractNumber, `%${loanAccount}%`));

  const sortColumn = SORT_OPTIONS[sortKey];
  const orderBy = sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);

  // Query 1: which checks match the filters — grouped at the check grain, not
  // the line-item grain, so a check with 5 land contracts is one row here.
  const matchingChecks = await db
    .selectDistinct({
      checkId: checks.id,
      checkNumber: checks.checkNumber,
      checkDate: checks.checkDate,
      payeeCode: checks.payeeCode,
      payeeName: checks.payeeName,
      totalAmountCents: checks.totalAmountCents,
    })
    .from(checks)
    .leftJoin(checkLineItems, eq(checkLineItems.checkId, checks.id))
    .leftJoin(contracts, eq(checkLineItems.contractId, contracts.id))
    .where(and(...conditions))
    .orderBy(orderBy, desc(checks.checkNumber))
    .limit(CHECK_CAP + 1);

  const truncated = matchingChecks.length > CHECK_CAP;
  const checksToShow = matchingChecks.slice(0, CHECK_CAP);

  // Query 2: every line item for exactly those checks, in one batch (not
  // one query per check — see Lender Payment Run for why that matters).
  const checkIds = checksToShow.map((c) => c.checkId);
  const lineItemRows =
    checkIds.length > 0
      ? await db
          .select({
            lineItemId: checkLineItems.id,
            checkId: checkLineItems.checkId,
            loanAccountRaw: checkLineItems.loanAccountRaw,
            contractId: contracts.id,
            contractNumber: contracts.contractNumber,
            amountCents: checkLineItems.amountCents,
            servicingFeeCents: checkLineItems.servicingFeeCents,
            interestCents: checkLineItems.interestCents,
            principalCents: checkLineItems.principalCents,
          })
          .from(checkLineItems)
          .leftJoin(contracts, eq(checkLineItems.contractId, contracts.id))
          .where(inArray(checkLineItems.checkId, checkIds))
      : [];

  const lineItemsByCheck = new Map<string, typeof lineItemRows>();
  for (const item of lineItemRows) {
    const list = lineItemsByCheck.get(item.checkId) ?? [];
    list.push(item);
    lineItemsByCheck.set(item.checkId, list);
  }

  // Total shown is always the sum of the check's OWN line items, not the
  // stored checks.totalAmountCents — ~18% of historical lender checks have a
  // recorded total that doesn't match summing their own line items (a
  // pre-existing TMO import quirk). Deriving it live guarantees the summary
  // total always reconciles exactly with what Detail expands to show.
  const groups = checksToShow.map((c) => {
    const lineItems = lineItemsByCheck.get(c.checkId) ?? [];
    const totalAmountCents = lineItems.reduce((s, i) => s + i.amountCents, 0);
    return { ...c, lineItems, totalAmountCents };
  });
  const totalCents = groups.reduce((s, g) => s + g.totalAmountCents, 0);
  const totalLineItems = lineItemRows.length;

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
    return qs ? `/lenders/check-register?${qs}` : "/lenders/check-register";
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="mb-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
        <ClipboardList size={20} className="text-slate-400" aria-hidden="true" />
        Lender Check Register
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        {groups.length} checks{truncated ? ` (capped at ${CHECK_CAP} — narrow your filters to see more precisely)` : ""} ·{" "}
        {totalLineItems} land contract payments · Total: {formatCents(totalCents)}
        {!hasAnyFilterParam && " · Showing the last 30 days by default"}
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
            Lender / Payee
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
              <th className="px-4 py-3">Land Contract</th>
              <SortHeader label="Amount" sortKeyValue="amount" align="right" currentSort={sortKey} currentDir={sortDir} buildHref={buildHref} />
              <th className="px-4 py-3 text-right">Serv. Fee</th>
              <th className="px-4 py-3 text-right">Interest</th>
              <th className="px-4 py-3 text-right">Principal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groups.map((group) => (
              <CheckRegisterRow
                key={group.checkId}
                checkDate={formatDate(group.checkDate)}
                checkNumber={group.checkNumber}
                payeeName={group.payeeName}
                payeeCode={group.payeeCode}
                totalAmountCents={group.totalAmountCents}
                lineItems={group.lineItems}
              />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
