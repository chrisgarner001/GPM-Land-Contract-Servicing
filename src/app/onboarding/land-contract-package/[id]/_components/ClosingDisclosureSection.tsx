"use client";

import { useState, type ChangeEvent, type RefObject } from "react";
import type { Answers } from "@/domain/landContractPackage/answers";
import { buildClosingStatement } from "@/domain/landContractPackage/closingStatement";
import { buildClosingStatementInput } from "@/domain/landContractPackage/renderData";
import { compareClosingDisclosureAction } from "../actions";

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string; // "data:application/pdf;base64,XXXX"
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read the file."));
    reader.readAsDataURL(file);
  });
}

function formDataToAnswers(fd: FormData): Answers {
  const out: Answers = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

interface ComparisonRow {
  label: string;
  ours: number | null;
  cd: number | null;
  isPercent?: boolean;
}

function formatValue(v: number | null, isPercent?: boolean): string {
  if (v === null) return "—";
  return isPercent ? `${v.toFixed(3)}%` : v.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function matches(a: number | null, b: number | null, isPercent?: boolean): boolean | null {
  if (a === null || b === null) return null;
  const tolerance = isPercent ? 0.01 : 1; // 0.01 pt for rate, $1 for dollar figures
  return Math.abs(a - b) <= tolerance;
}

// Staff produce this in their own software and must send it to the buyer 5
// days before closing. Uploaded here purely to cross-reference its figures
// against this package's own calculations — see buildClosingStatement — and
// archived with the rest of the package's documents on Publish (see
// generateAllFiles in generatePackage.ts). The file itself never leaves the
// browser except to go straight to the extraction call and into this form's
// own hidden fields, matching how every other answer on this form persists.
export default function ClosingDisclosureSection({
  initialAnswers,
  formRef,
}: {
  initialAnswers: Answers;
  formRef: RefObject<HTMLFormElement | null>;
}) {
  const [filename, setFilename] = useState(initialAnswers.buyer_cd_filename ?? "");
  const [base64, setBase64] = useState(initialAnswers.buyer_cd_base64 ?? "");
  const [reading, setReading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ComparisonRow[] | null>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setRows(null);
    setReading(true);
    try {
      const b64 = await readFileAsBase64(file);
      setBase64(b64);
      setFilename(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read the file.");
    } finally {
      setReading(false);
    }
  }

  async function handleCompare() {
    if (!base64) {
      setError("Upload the Buyer Closing Disclosure first.");
      return;
    }
    setError(null);
    setComparing(true);
    try {
      const liveAnswers = formRef.current ? formDataToAnswers(new FormData(formRef.current)) : initialAnswers;
      const ours = buildClosingStatement(buildClosingStatementInput(liveAnswers));

      const result = await compareClosingDisclosureAction(base64);
      if (result.error || !result.data) {
        setError(result.error ?? "Couldn't read the Closing Disclosure.");
        return;
      }
      const cd = result.data;
      const num = (v: string | null | undefined) => (v ? Number(v) : null);

      setRows([
        { label: "Sale Price", ours: Number(liveAnswers.purchase_price) || null, cd: num(cd.salePrice) },
        { label: "Loan Amount", ours: Number(liveAnswers.original_principal) || null, cd: num(cd.loanAmount) },
        { label: "Down Payment", ours: Number(liveAnswers.down_payment) || null, cd: num(cd.downPayment) },
        { label: "Interest Rate", ours: Number(liveAnswers.interest_rate) || null, cd: num(cd.interestRateAnnual), isPercent: true },
        { label: "Monthly P&I Payment", ours: Number(liveAnswers.monthly_pi_payment) || null, cd: num(cd.monthlyPrincipalAndInterest) },
        { label: "Cash to Close (Due from Buyer)", ours: ours.cashDueFromBuyerAtClosing, cd: num(cd.cashToCloseFromBorrower) },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed.");
    } finally {
      setComparing(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Buyer Closing Disclosure (CD)</h3>
      <p className="mb-3 text-xs text-slate-400">
        Upload the Buyer CD staff send 5 days before closing to cross-reference its figures against this package&apos;s own calculations.
        Archived with the rest of the package&apos;s documents on Publish.
      </p>

      <input type="hidden" name="buyer_cd_filename" value={filename} />
      <input type="hidden" name="buyer_cd_base64" value={base64} />

      <div className="flex flex-wrap items-center gap-3">
        <input type="file" accept="application/pdf" onChange={handleFileChange} className="text-sm" />
        {filename && <span className="text-xs text-slate-500">Attached: {filename}</span>}
        <button
          type="button"
          onClick={handleCompare}
          disabled={!base64 || reading || comparing}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {comparing ? "Comparing…" : "Compare to Our Calculations"}
        </button>
      </div>

      {reading && <p className="mt-2 text-xs text-slate-400">Reading file…</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {rows && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-1.5 pr-3">Figure</th>
                <th className="py-1.5 pr-3">Our Calculation</th>
                <th className="py-1.5 pr-3">Buyer CD</th>
                <th className="py-1.5">Match</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const ok = matches(row.ours, row.cd, row.isPercent);
                return (
                  <tr key={row.label}>
                    <td className="py-1.5 pr-3 text-slate-700">{row.label}</td>
                    <td className="py-1.5 pr-3 font-mono text-slate-900">{formatValue(row.ours, row.isPercent)}</td>
                    <td className="py-1.5 pr-3 font-mono text-slate-900">{formatValue(row.cd, row.isPercent)}</td>
                    <td className="py-1.5">
                      {ok === null ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : ok ? (
                        <span className="text-xs font-medium text-emerald-700">Match</span>
                      ) : (
                        <span className="text-xs font-medium text-red-600">Mismatch</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
