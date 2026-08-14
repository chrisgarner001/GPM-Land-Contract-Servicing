"use client";

import { useState, useTransition } from "react";
import { extractChecks, submitBulkPayments, type BulkCheckRow } from "../actions";
import { formatCents } from "@/lib/format";

interface Row extends BulkCheckRow {
  id: number;
  receivedDate: string;
  include: boolean;
}

export default function BulkPaymentClient({ contractOptions }: { contractOptions: { id: string; label: string }[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [extracting, startExtracting] = useTransition();
  const [submitting, startSubmitting] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  function handleFiles(formData: FormData) {
    setError(null);
    setResult(null);
    startExtracting(async () => {
      const res = await extractChecks(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      setRows(
        res.rows.map((r, i) => ({
          ...r,
          id: Date.now() + i,
          receivedDate: today,
          include: r.amountCents > 0,
        }))
      );
    });
  }

  function updateRow(id: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function handleSubmit() {
    setResult(null);
    const toSubmit = rows.filter((r) => r.include && r.matchedContractId && r.amountCents > 0);
    if (toSubmit.length === 0) {
      setError("No confirmed rows with a matched contract to record.");
      return;
    }
    const submittedIds = new Set(toSubmit.map((r) => r.id));
    startSubmitting(async () => {
      const res = await submitBulkPayments(
        toSubmit.map((r) => ({
          contractId: r.matchedContractId!,
          amountCents: r.amountCents,
          receivedDate: r.receivedDate,
          referenceNumber: r.checkNumber,
        }))
      );
      setResult(
        `Recorded ${res.recorded} payment(s).` +
          (res.failed.length > 0 ? ` ${res.failed.length} failed: ${res.failed.map((f) => f.error).join("; ")}` : "")
      );
      setRows((prev) => prev.filter((r) => !submittedIds.has(r.id)));
    });
  }

  return (
    <div className="space-y-6">
      <form action={handleFiles} className="rounded-lg border border-slate-200 shadow-sm p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Upload Check Images</h3>
        <div className="flex items-center gap-3">
          <input
            type="file"
            name="checks"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            required
            className="text-sm"
          />
          <button
            type="submit"
            disabled={extracting}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {extracting ? "Reading checks..." : "Extract"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </form>

      {rows.length > 0 && (
        <div className="rounded-lg border border-slate-200 shadow-sm bg-white p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Review &amp; Match</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Include</th>
                  <th className="py-2 pr-3">File</th>
                  <th className="py-2 pr-3">Payer (Extracted)</th>
                  <th className="py-2 pr-3 text-right">Amount</th>
                  <th className="py-2 pr-3">Check #</th>
                  <th className="py-2 pr-3">Date Received</th>
                  <th className="py-2 pr-3">Matched Contract</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className={!r.matchedContractId ? "bg-amber-50" : ""}>
                    <td className="py-1.5 pr-3">
                      <input
                        type="checkbox"
                        checked={r.include}
                        onChange={(e) => updateRow(r.id, { include: e.target.checked })}
                      />
                    </td>
                    <td className="py-1.5 pr-3 text-slate-500">{r.fileName}</td>
                    <td className="py-1.5 pr-3 text-slate-700">{r.payerName}</td>
                    <td className="py-1.5 pr-3 text-right">
                      <input
                        type="number"
                        step="0.01"
                        defaultValue={(r.amountCents / 100).toFixed(2)}
                        onChange={(e) => updateRow(r.id, { amountCents: Math.round(Number(e.target.value) * 100) })}
                        className="w-24 rounded border border-slate-300 px-1.5 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="py-1.5 pr-3 text-slate-500">{r.checkNumber ?? "—"}</td>
                    <td className="py-1.5 pr-3">
                      <input
                        type="date"
                        value={r.receivedDate}
                        onChange={(e) => updateRow(r.id, { receivedDate: e.target.value })}
                        className="rounded border border-slate-300 px-1.5 py-1 text-sm"
                      />
                    </td>
                    <td className="py-1.5 pr-3">
                      <select
                        value={r.matchedContractId ?? ""}
                        onChange={(e) =>
                          updateRow(r.id, {
                            matchedContractId: e.target.value || null,
                            matchedContractLabel: contractOptions.find((c) => c.id === e.target.value)?.label ?? null,
                          })
                        }
                        className="w-full rounded border border-slate-300 px-1.5 py-1 text-sm"
                      >
                        <option value="">— No match, select manually —</option>
                        {contractOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? "Recording..." : "Record Payments"}
            </button>
            <span className="text-xs text-slate-400">Total: {formatCents(rows.filter((r) => r.include).reduce((s, r) => s + r.amountCents, 0))}</span>
          </div>
          {result && <p className="mt-3 text-sm text-emerald-700">{result}</p>}
        </div>
      )}
    </div>
  );
}
