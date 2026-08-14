import Link from "next/link";
import { Send } from "lucide-react";
import { getLendersWithOutstandingBalance, getDefaultSweepBaselineDate } from "@/server/lenderPaymentRuns";
import { formatCents, formatDate } from "@/lib/format";
import ProcessDistributionForm from "./_components/ProcessDistributionForm";
import StopPropagationLink from "./_components/StopPropagationLink";
import OverrideReleaseButton from "./_components/OverrideReleaseButton";

const DISPLAY_LINE_ITEM_CAP = 500;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function LenderPaymentRunPage({
  searchParams,
}: {
  searchParams: Promise<{ runDate?: string; sweepBaseline?: string }>;
}) {
  const params = await searchParams;
  const runDate = params.runDate || todayIso();
  const sweepBaselineDate = params.sweepBaseline || (await getDefaultSweepBaselineDate());

  const lenders = await getLendersWithOutstandingBalance(runDate, sweepBaselineDate);
  const lenderBlocks = lenders.map((lender) => ({
    ...lender,
    items: lender.items.slice(0, DISPLAY_LINE_ITEM_CAP),
    truncated: lender.items.length > DISPLAY_LINE_ITEM_CAP,
  }));

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
        <Send size={20} className="text-slate-400" aria-hidden="true" />
        Lender Payment Run
      </h1>
      <p className="mb-4 text-sm text-slate-500">
        Lenders with outstanding activity as of the run date below. Statement documents, emailing, and portal posting
        are a later phase — this screen produces the check/ACH distribution record only.
      </p>

      <form method="get" className="mb-6 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="runDate">
            Run Date
          </label>
          <input
            id="runDate"
            type="date"
            name="runDate"
            defaultValue={runDate}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="sweepBaseline">
            Last Sweep
          </label>
          <input
            id="sweepBaseline"
            type="date"
            name="sweepBaseline"
            defaultValue={sweepBaselineDate}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
          Run
        </button>
      </form>
      <p className="mb-1 text-xs text-slate-400">
        Only activity dated after Last Sweep counts as outstanding — everything on or before that date is treated as
        already paid out (e.g. via TMO, before this app tracked it live).
      </p>
      <p className="mb-6 text-xs text-slate-400">
        Late Charges are the lender&apos;s own money and are already included in Total. Other Charges are shown for
        context only — that revenue stays with SGMS and is never part of the lender&apos;s Total.
      </p>

      {lenderBlocks.length === 0 ? (
        <p className="text-sm text-slate-400">No lenders have outstanding activity as of {formatDate(runDate)}.</p>
      ) : (
        <div className="space-y-8">
          {lenderBlocks.map((lender) => {
            const hasMultiple = lender.items.length > 1;
            const singleItem = lender.items.length === 1 ? lender.items[0] : null;
            const contractCount = new Set(lender.items.map((i) => i.contractId)).size;

            return (
              <div key={lender.lenderPartyId} className="rounded-lg border border-slate-200 bg-white shadow-sm">
                {hasMultiple ? (
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-2">
                        <svg
                          className="h-4 w-4 flex-shrink-0 text-slate-400 transition-transform group-open:rotate-90"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <StopPropagationLink href={`/lenders/${lender.lenderPartyId}`} className="font-medium text-blue-700 hover:underline">
                          {lender.displayName}
                        </StopPropagationLink>
                        <span className="text-xs text-slate-500">
                          {lender.items.length} payments across {contractCount} contract{contractCount === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums text-slate-900">{formatCents(lender.balanceCents)}</span>
                    </summary>

                    {lender.truncated && (
                      <p className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-700">
                        Showing the first {lender.items.length} line items — more exist. The total above still
                        reflects the full outstanding balance.
                      </p>
                    )}

                    <div className="overflow-x-auto border-t border-slate-100">
                      <table className="w-full min-w-[800px] text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <th className="px-4 py-3">Land Contract</th>
                            <th className="px-4 py-3">Payment Date</th>
                            <th className="px-4 py-3 text-right">Payment Amount</th>
                            <th className="px-4 py-3 text-right">Interest</th>
                            <th className="px-4 py-3 text-right">Principal</th>
                            <th className="px-4 py-3 text-right">Late Charges</th>
                            <th className="px-4 py-3 text-right">Other Charges</th>
                            <th className="px-4 py-3 text-right">SGMS Fee</th>
                            <th className="px-4 py-3 text-right">Total</th>
                            <th className="px-4 py-3">Release</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {lender.items.map((item) => (
                            <tr key={item.id} className={item.heldForRelease ? "bg-amber-50/50" : undefined}>
                              <td className="px-4 py-3">
                                {item.contractId ? (
                                  <Link href={`/contracts/${item.contractId}`} prefetch={false} className="font-medium text-blue-700 hover:underline">
                                    {item.contractNumber}
                                  </Link>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="px-4 py-3 text-slate-600">{formatDate(item.paymentDate)}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                                {formatCents(item.interestCents + item.principalCents)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-slate-500">{formatCents(item.interestCents)}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-slate-500">{formatCents(item.principalCents)}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-slate-500">{formatCents(item.lateChargesCents)}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-slate-400">{formatCents(item.otherChargesCents)}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                                {formatCents(item.servicingFeeCents)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                                {formatCents(item.amountReceivedCents)}
                              </td>
                              <td className="px-4 py-3">
                                {item.heldForRelease && item.paymentId ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-amber-700">Held until {formatDate(item.releaseDate)}</span>
                                    <OverrideReleaseButton paymentId={item.paymentId} />
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ) : (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="flex items-center gap-2">
                      <Link href={`/lenders/${lender.lenderPartyId}`} prefetch={false} className="font-medium text-blue-700 hover:underline">
                        {lender.displayName}
                      </Link>
                      {singleItem?.contractId && (
                        <Link href={`/contracts/${singleItem.contractId}`} prefetch={false} className="text-xs text-slate-500 hover:underline">
                          {singleItem.contractNumber}
                        </Link>
                      )}
                      {singleItem?.heldForRelease && (
                        <span className="text-xs text-amber-700">Held until {formatDate(singleItem.releaseDate)}</span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      {singleItem?.heldForRelease && singleItem.paymentId && (
                        <OverrideReleaseButton paymentId={singleItem.paymentId} />
                      )}
                      <span className="font-semibold tabular-nums text-slate-900">{formatCents(lender.balanceCents)}</span>
                    </span>
                  </div>
                )}

                {lender.balanceCents > 0 && (
                  <div className="border-t border-slate-100 p-4">
                    <ProcessDistributionForm
                      lenderPartyId={lender.lenderPartyId}
                      runDate={runDate}
                      sweepBaselineDate={sweepBaselineDate}
                      preferredPaymentMethod={lender.preferredPaymentMethod}
                      totalCents={lender.balanceCents}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
