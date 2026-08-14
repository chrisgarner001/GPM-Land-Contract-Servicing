"use client";

import { useActionState } from "react";
import { formatCents, formatDate, formatDateTime } from "@/lib/format";
import { refreshAssessorData, type RefreshAssessorDataState } from "../actions";

export interface AssessorSnapshot {
  fetchedAt: string;
  county: string | null;
  apn: string | null;
  ownerFullName: string | null;
  assessedValueCents: number | null;
  estimatedMarketValueCents: number | null;
  annualTaxAmountCents: number | null;
  taxYear: string | null;
  isTaxExemption: boolean | null;
  exemptionType: string | null;
  lastSaleDate: string | null;
  lastSaleAmountCents: number | null;
  isListed: boolean | null;
  isListedDate: string | null;
  yearBuilt: string | null;
  beds: number | null;
  baths: string | null;
  sqft: number | null;
  legalDescription: string | null;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium tabular-nums text-slate-900">{value}</span>
    </div>
  );
}

export default function AssessorDataCard({ propertyId, snapshot }: { propertyId: string; snapshot: AssessorSnapshot | null }) {
  const action = refreshAssessorData.bind(null, propertyId);
  const [state, formAction, pending] = useActionState<RefreshAssessorDataState | undefined, FormData>(action, undefined);

  return (
    <div className="rounded-lg border border-slate-200 shadow-sm p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Assessor Data</h3>
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {pending ? "Looking up…" : snapshot ? "Refresh" : "Look Up Assessor Data"}
          </button>
        </form>
      </div>

      {state?.error && <p className="mb-2 text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="mb-2 text-sm text-emerald-700">{state.success}</p>}

      {!snapshot ? (
        <p className="text-sm text-slate-400">No assessor data on file yet. Each lookup is a billed AssessorSearch credit.</p>
      ) : (
        <>
          <Row label="County" value={snapshot.county ?? "—"} />
          <Row label="Parcel Number" value={snapshot.apn ?? "—"} />
          <Row label="Owner of Record" value={snapshot.ownerFullName ?? "—"} />
          <Row label="Assessed Value" value={formatCents(snapshot.assessedValueCents)} />
          <Row label="Estimated Market Value" value={formatCents(snapshot.estimatedMarketValueCents)} />
          <Row
            label={`Annual Tax${snapshot.taxYear ? ` (${snapshot.taxYear})` : ""}`}
            value={formatCents(snapshot.annualTaxAmountCents)}
          />
          <Row
            label="Exemption"
            value={snapshot.isTaxExemption ? snapshot.exemptionType || "Yes" : "None"}
          />
          <Row
            label="Last Sale"
            value={
              snapshot.lastSaleDate
                ? `${formatCents(snapshot.lastSaleAmountCents)} on ${formatDate(snapshot.lastSaleDate)}`
                : "—"
            }
          />
          <Row
            label="Listing Status"
            value={snapshot.isListed ? `Listed for sale${snapshot.isListedDate ? ` (${formatDate(snapshot.isListedDate)})` : ""}` : "Not listed"}
          />
          <Row
            label="Beds / Baths / Sqft"
            value={`${snapshot.beds ?? "—"} / ${snapshot.baths ?? "—"} / ${snapshot.sqft ?? "—"}`}
          />
          <Row label="Year Built" value={snapshot.yearBuilt ?? "—"} />
          {snapshot.legalDescription && (
            <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
              Assessor legal description: {snapshot.legalDescription}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-400">Last refreshed {formatDateTime(snapshot.fetchedAt)}</p>
        </>
      )}
    </div>
  );
}
