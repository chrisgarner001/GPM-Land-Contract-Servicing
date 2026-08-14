import Link from "next/link";
import CategoryTabs from "../../../_components/CategoryTabs";
import ReportActionBar from "../../_components/ReportActionBar";
import { getBorrowerContractOptions, getPayoffLetterData } from "@/server/borrowerReports";
import { formatCents, formatDate } from "@/lib/format";
import { emailPayoffLetterAction, postPayoffLetterAction } from "./actions";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function PayoffLetterPage({
  searchParams,
}: {
  searchParams: Promise<{ contractId?: string; payoffDate?: string; recipientName?: string; recipientEmail?: string }>;
}) {
  const params = await searchParams;
  const payoffDate = params.payoffDate || todayIso();
  const recipientName = params.recipientName ?? "";
  const recipientEmail = params.recipientEmail ?? "";

  const contractOptions = await getBorrowerContractOptions();
  const selected = contractOptions.find((c) => c.id === params.contractId);

  let data = null;
  let error: string | null = null;
  if (params.contractId) {
    try {
      data = await getPayoffLetterData(params.contractId, payoffDate, recipientName);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to generate the payoff letter.";
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link href="/reports/borrower" className="text-sm font-medium text-blue-700 hover:underline print:hidden">
        ← Borrower Reports
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold text-slate-900 print:hidden">Payoff Letter</h1>
      <p className="mb-4 text-sm text-slate-500 print:hidden">
        Payoff amount (principal + accrued interest) as of a projected payoff date, with the per diem to add for each day
        after that.
      </p>
      <div className="print:hidden">
        <CategoryTabs basePath="/reports" />
      </div>

      <form method="get" className="mb-8 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="contractId">
            Land Contract
          </label>
          <select id="contractId" name="contractId" defaultValue={params.contractId ?? ""} className="w-64 rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Select…</option>
            {contractOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="payoffDate">
            Projected Payoff Date
          </label>
          <input id="payoffDate" type="date" name="payoffDate" defaultValue={payoffDate} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="recipientName">
            Send To (Name)
          </label>
          <input
            id="recipientName"
            type="text"
            name="recipientName"
            defaultValue={recipientName}
            placeholder="Borrower, title company, attorney…"
            className="w-56 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="recipientEmail">
            Send To (Email)
          </label>
          <input
            id="recipientEmail"
            type="email"
            name="recipientEmail"
            defaultValue={recipientEmail || selected?.buyerEmail || selected?.borrowerPortalEmail || ""}
            className="w-56 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
          Generate
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!data ? (
        !error && <p className="text-sm text-slate-400">Select a land contract and payoff date, then click Generate.</p>
      ) : (
        <>
          <ReportActionBar
            excelHref={`/reports/borrower/payoff-letter/export?contractId=${data.contractId}&payoffDate=${payoffDate}&recipientName=${encodeURIComponent(recipientName)}`}
            defaultRecipientEmail={recipientEmail || selected?.buyerEmail || selected?.borrowerPortalEmail || ""}
            onEmail={emailPayoffLetterAction.bind(null, data.contractId, payoffDate, recipientName)}
            onPost={postPayoffLetterAction.bind(null, data.contractId, payoffDate, recipientName)}
          />

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Payoff Letter — {data.contractNumber}</h2>
            <p className="mb-4 text-sm text-slate-500">
              {data.recipientName && (
                <>
                  {data.recipientName}
                  <br />
                </>
              )}
              Re: {data.borrowerName}
              <br />
              {data.propertyAddress}
            </p>

            <p className="mb-4 text-sm text-slate-700">
              As of <span className="font-semibold">{formatDate(data.payoffDate)}</span>, the payoff amount for this land
              contract is:
            </p>

            <div className="mb-4 overflow-x-auto">
              <table className="w-full max-w-md text-sm">
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-1.5 text-slate-500">Principal Balance</td>
                    <td className="py-1.5 text-right">{formatCents(data.quote.principalBalanceCents)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-500">Accrued Interest ({data.quote.days} days)</td>
                    <td className="py-1.5 text-right">{formatCents(data.quote.accruedInterestCents)}</td>
                  </tr>
                  {data.quote.unpaidInterestCents > 0 && (
                    <tr>
                      <td className="py-1.5 text-slate-500">Unpaid Prior Interest</td>
                      <td className="py-1.5 text-right">{formatCents(data.quote.unpaidInterestCents)}</td>
                    </tr>
                  )}
                  {data.quote.unpaidLateChargesCents > 0 && (
                    <tr>
                      <td className="py-1.5 text-slate-500">Late Charges</td>
                      <td className="py-1.5 text-right">{formatCents(data.quote.unpaidLateChargesCents)}</td>
                    </tr>
                  )}
                  {data.quote.unpaidOtherChargesCents > 0 && (
                    <tr>
                      <td className="py-1.5 text-slate-500">Other Charges</td>
                      <td className="py-1.5 text-right">{formatCents(data.quote.unpaidOtherChargesCents)}</td>
                    </tr>
                  )}
                  <tr className="border-t border-slate-200 font-semibold text-slate-900">
                    <td className="py-1.5">Total Payoff Amount</td>
                    <td className="py-1.5 text-right">{formatCents(data.quote.totalPayoffAmountCents)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-sm text-slate-600">
              This quote is valid through <span className="font-semibold">{formatDate(data.expirationDate)}</span>. If
              payoff is received after {formatDate(data.payoffDate)}, add{" "}
              <span className="font-semibold">{formatCents(data.quote.perDiemInterestCents)}</span> per day for each
              additional day through the expiration date. A new payoff quote is required after that date.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
