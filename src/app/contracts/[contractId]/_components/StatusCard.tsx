"use client";

import { useActionState } from "react";
import { updateCourtStatus, type UpdateCourtStatusState } from "../actions";

interface StatusCardProps {
  contractId: string;
  contractStatus: string;
  daysPastDue: number;
  forfeitureNoticeSentDate: string | null;
  courtHearingDate: string | null;
  judgmentReceivedDate: string | null;
  evictionDate: string | null;
  legalProcessStage: string | null;
  inBankruptcy: boolean;
}

const LEGAL_PROCESS_STAGE_LABELS: Record<string, string> = {
  COURT: "Court",
  FORECLOSED: "Foreclosed",
  FORFEITED: "Forfeited",
};

const LEGAL_PROCESS_STAGE_STYLES: Record<string, string> = {
  COURT: "bg-orange-50 text-orange-700 ring-orange-600/20",
  FORECLOSED: "bg-red-100 text-red-800 ring-red-700/30",
  FORFEITED: "bg-purple-50 text-purple-700 ring-purple-600/20",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  PAID_OFF: "Paid Off",
  DEFAULTED: "Defaulted",
  IN_FORECLOSURE: "In Foreclosure",
  CANCELLED: "Cancelled",
};

function delinquencyBadge(daysPastDue: number): { label: string; className: string } | null {
  if (daysPastDue >= 90) return { label: "90+ Days Past Due", className: "bg-red-50 text-red-700 ring-red-600/20" };
  if (daysPastDue >= 60) return { label: "60+ Days Past Due", className: "bg-yellow-50 text-yellow-800 ring-yellow-600/20" };
  if (daysPastDue >= 30) return { label: "30+ Days Past Due", className: "bg-blue-50 text-blue-700 ring-blue-600/20" };
  return null;
}

export default function StatusCard({
  contractId,
  contractStatus,
  daysPastDue,
  forfeitureNoticeSentDate,
  courtHearingDate,
  judgmentReceivedDate,
  evictionDate,
  legalProcessStage,
  inBankruptcy,
}: StatusCardProps) {
  const action = updateCourtStatus.bind(null, contractId);
  const [state, formAction, pending] = useActionState<UpdateCourtStatusState | undefined, FormData>(action, undefined);

  const delinquency = contractStatus === "ACTIVE" ? delinquencyBadge(daysPastDue) : null;

  return (
    <div className="rounded-lg border border-slate-200 shadow-sm p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Status</h3>

      <div className="mb-4 flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
          {STATUS_LABELS[contractStatus] ?? contractStatus}
        </span>
        {delinquency && (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${delinquency.className}`}>
            {delinquency.label}
          </span>
        )}
        {legalProcessStage && (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
              LEGAL_PROCESS_STAGE_STYLES[legalProcessStage] ?? "bg-slate-100 text-slate-600 ring-slate-500/20"
            }`}
          >
            {LEGAL_PROCESS_STAGE_LABELS[legalProcessStage] ?? legalProcessStage}
          </span>
        )}
        {inBankruptcy && (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800 ring-1 ring-inset ring-red-700/30">
            Bankruptcy
          </span>
        )}
      </div>

      {inBankruptcy && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-800 ring-1 ring-inset ring-red-600/20">
          This borrower is in bankruptcy. Do not send late notices or initiate contact — the automatic stay prohibits
          creditor communication. Only respond if they contact us first.
        </p>
      )}

      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Court Status</h4>
      <form action={formAction} className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" name="inBankruptcy" value="1" defaultChecked={inBankruptcy} />
            In Bankruptcy
          </label>
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs text-slate-500" htmlFor="legalProcessStage">
            Legal Process Stage
          </label>
          <select
            id="legalProcessStage"
            name="legalProcessStage"
            defaultValue={legalProcessStage ?? ""}
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">—</option>
            {Object.entries(LEGAL_PROCESS_STAGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="forfeitureNoticeSentDate">
            Forfeiture Notice Sent
          </label>
          <input
            id="forfeitureNoticeSentDate"
            name="forfeitureNoticeSentDate"
            type="date"
            defaultValue={forfeitureNoticeSentDate ?? ""}
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="courtHearingDate">
            Court Hearing Date
          </label>
          <input
            id="courtHearingDate"
            name="courtHearingDate"
            type="date"
            defaultValue={courtHearingDate ?? ""}
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="judgmentReceivedDate">
            Judgment Received
          </label>
          <input
            id="judgmentReceivedDate"
            name="judgmentReceivedDate"
            type="date"
            defaultValue={judgmentReceivedDate ?? ""}
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="evictionDate">
            Eviction Date
          </label>
          <input
            id="evictionDate"
            name="evictionDate"
            type="date"
            defaultValue={evictionDate ?? ""}
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="col-span-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save"}
          </button>
          {state?.success && <span className="text-sm text-emerald-700">{state.success}</span>}
          {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
        </div>
      </form>
    </div>
  );
}
