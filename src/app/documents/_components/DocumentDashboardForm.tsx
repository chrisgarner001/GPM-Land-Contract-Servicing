"use client";

import { useMemo, useState } from "react";
import { calculateMichiganTransferTax } from "@/domain/documents/transferTax";
import type { DeedType } from "@/domain/documents/generateDeedDocx";
import {
  buildDefaultFields,
  buildRenderData,
  familyOf,
  formatCents,
  getPerContractKeys,
  REQUIRED_BY_FAMILY,
  type Fields,
} from "@/domain/documents/buildRenderData";
import type { ContractOption } from "@/server/documents";
import type { ContractPreview } from "@/app/documents/preview/route";

const DEED_TYPES: DeedType[] = ["QCD", "WD", "WDS", "LC", "QCDLC", "LCA"];

const DEED_LABELS: Record<DeedType, string> = {
  QCD: "Quitclaim Deed",
  WD: "Warranty Deed (Exempt)",
  WDS: "Warranty Deed (Sale)",
  LC: "QCD – Land Contract Interest",
  QCDLC: "QCD – LC Subject to Purchaser",
  LCA: "LC Seller's Assignment",
};

const ENTITY_TYPE_OPTIONS = [
  { value: "an individual", label: "Individual" },
  { value: "a Michigan Limited Liability Company", label: "Michigan LLC" },
  { value: "a Delaware Limited Liability Company", label: "Delaware LLC" },
  { value: "a Michigan corporation", label: "Michigan Corporation" },
  { value: "a Michigan general partnership", label: "Michigan General Partnership" },
  { value: "a trust", label: "Trust" },
  { value: "a married couple", label: "Married Couple (Joint Tenants)" },
];

const MONTH_OPTIONS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const inputClass = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none";
const labelClass = "mb-1 block text-xs font-medium text-slate-600";

function Field({
  label, value, onChange, placeholder, type = "text", required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className={labelClass}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  );
}

function TypeSelect({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <label className={labelClass}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">-- Select --</option>
        {ENTITY_TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function PerContractNote({ text }: { text: string }) {
  return <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">{text}</p>;
}

export default function DocumentDashboardForm({
  contractOptions,
  initialSelectedContractId,
  companyDefaults,
}: {
  contractOptions: ContractOption[];
  initialSelectedContractId: string | null;
  companyDefaults: { contactName: string; contactAddress: string; contactCsz: string; notaryState: string };
}) {
  const [deedType, setDeedType] = useState<DeedType>("QCD");
  const [fields, setFields] = useState<Fields>(() => buildDefaultFields(companyDefaults));
  const [contractSearch, setContractSearch] = useState("");
  const [selectedContractIds, setSelectedContractIds] = useState<Set<string>>(
    () => new Set(initialSelectedContractId ? [initialSelectedContractId] : [])
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previews, setPreviews] = useState<ContractPreview[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const family = familyOf(deedType);
  const batchMode = selectedContractIds.size > 0;
  const perContractKeySet = useMemo(() => new Set(getPerContractKeys(deedType)), [deedType]);
  const granteeIsPerContract = deedType === "WD" || deedType === "WDS";
  const salePriceIsPerContract = deedType === "WDS" && batchMode;

  const set = (key: string) => (value: string) => setFields((prev) => ({ ...prev, [key]: value }));

  const salePriceCents = Math.round((Number(fields.sale_price) || 0) * 100);
  const transferTax = useMemo(() => calculateMichiganTransferTax(salePriceCents), [salePriceCents]);

  function handleSalePriceChange(value: string) {
    setFields((prev) => {
      const cents = Math.round((Number(value) || 0) * 100);
      return { ...prev, sale_price: value, consideration: cents > 0 ? formatCents(cents) : prev.consideration };
    });
  }

  function toggleContract(id: string) {
    setPreviews(null);
    setSelectedContractIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const contractsByLender = useMemo(() => {
    const groups = new Map<string, ContractOption[]>();
    for (const c of contractOptions) {
      const key = c.lenderName ?? "No Active Lender";
      const list = groups.get(key) ?? [];
      list.push(c);
      groups.set(key, list);
    }
    return [...groups.entries()];
  }, [contractOptions]);

  const filteredContractsByLender = useMemo(() => {
    const q = contractSearch.trim().toLowerCase();
    if (!q) return contractsByLender;
    return contractsByLender
      .map(([lenderName, list]): [string, ContractOption[]] => [
        lenderName,
        list.filter(
          (c) =>
            c.contractNumber.toLowerCase().includes(q) ||
            (c.buyerName ?? "").toLowerCase().includes(q) ||
            lenderName.toLowerCase().includes(q)
        ),
      ])
      .filter(([, list]) => list.length > 0);
  }, [contractsByLender, contractSearch]);

  async function handlePreview() {
    setPreviewError(null);
    setPreviews(null);
    setPreviewLoading(true);
    try {
      const response = await fetch("/documents/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deedType, contractIds: [...selectedContractIds] }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Failed to load preview.");
      setPreviews(body.previews);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Failed to load preview.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleGenerate() {
    const requiredKeys = REQUIRED_BY_FAMILY[family]
      .filter((key) => !batchMode || !perContractKeySet.has(key))
      .filter((key) => !(deedType === "WDS" && key === "consideration"));
    const missing = requiredKeys.filter((key) => !fields[key]?.trim());
    if (missing.length > 0) {
      setError(`Please fill required fields: ${missing.map((k) => k.replace(/_/g, " ")).join(", ")}`);
      return;
    }
    if (!fields.sale_price && (deedType === "QCDLC" || (deedType === "WDS" && !batchMode))) {
      setError("Please enter the Sale Price.");
      return;
    }

    setError(null);
    setSuccess(null);
    setGenerating(true);
    try {
      const response = batchMode
        ? await fetch("/documents/generate-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deedType, contractIds: [...selectedContractIds], fields }),
          })
        : await (async () => {
            const renderData = buildRenderData(deedType, fields);
            const grantorName = renderData.grantor_name ?? renderData.seller_name;
            const granteeName = renderData.grantee_name ?? renderData.assignee_name;
            const propertyAddress = renderData.street_address ?? renderData.property_address ?? fields.street_address;
            return fetch("/documents/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ deedType, contractId: null, fields: renderData, grantorName, granteeName, propertyAddress }),
            });
          })();

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to generate document.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `${deedType}.docx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setSuccess(`Generated ${filename}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate document.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <label className={labelClass}>Prefill from Land Contracts (optional — check one or more)</label>
          {selectedContractIds.size > 0 && (
            <button type="button" onClick={() => setSelectedContractIds(new Set())} className="text-xs text-slate-500 hover:underline">
              Clear selection
            </button>
          )}
        </div>
        <input
          type="text"
          value={contractSearch}
          onChange={(e) => setContractSearch(e.target.value)}
          placeholder="Search by contract #, buyer, or lender…"
          className={`${inputClass} mb-2`}
        />
        <div className="max-h-72 overflow-y-auto rounded-md border border-slate-200">
          {filteredContractsByLender.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-slate-400">No contracts match &quot;{contractSearch}&quot;.</p>
          )}
          {filteredContractsByLender.map(([lenderName, contracts]) => (
            <div key={lenderName}>
              <p className="sticky top-0 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {lenderName}
              </p>
              <ul>
                {contracts.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 border-t border-slate-100 px-3 py-1.5 text-sm hover:bg-slate-50">
                    <label className="flex flex-1 items-center gap-2">
                      <input type="checkbox" checked={selectedContractIds.has(c.id)} onChange={() => toggleContract(c.id)} />
                      <span className="font-medium text-slate-800">{c.contractNumber}</span>
                      {c.buyerName && <span className="text-slate-500">— {c.buyerName}</span>}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {batchMode && (
          <p className="mt-2 text-xs text-slate-500">
            {selectedContractIds.size} contract{selectedContractIds.size === 1 ? "" : "s"} selected — Seller/Grantor, Buyer, and
            property details below will be pulled automatically from each one.
          </p>
        )}
        {previewError && <p className="mt-2 text-sm text-red-600">{previewError}</p>}
        {previews && (
          <div className="mt-3 space-y-2">
            {previews.map((p) => (
              <div key={p.contractId} className="rounded-md border border-slate-200 p-3 text-sm">
                <p className="mb-1.5 font-semibold text-slate-800">{p.contractNumber}</p>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Grantor / Seller</dt>
                    <dd className="text-right font-medium">{p.grantorName || "—"}</dd>
                  </div>
                  {p.granteeName !== undefined && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Grantee</dt>
                      <dd className="text-right font-medium">{p.granteeName || "—"}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Buyer / Borrower</dt>
                    <dd className="text-right font-medium">{p.buyerName || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Property</dt>
                    <dd className="text-right font-medium">
                      {p.streetAddress || "—"}, {p.county || "—"} County
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Parcel ID(s)</dt>
                    <dd className="text-right font-medium">{p.parcelIds || "—"}</dd>
                  </div>
                  {p.salePrice !== undefined && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Sale Price</dt>
                      <dd className="text-right font-medium tabular-nums">
                        {p.salePrice ? formatCents(Math.round(Number(p.salePrice) * 100)) : "—"}
                      </dd>
                    </div>
                  )}
                </dl>
                {p.missingFields.length > 0 && (
                  <p className="mt-1.5 text-xs text-amber-700">Missing: {p.missingFields.join(", ")}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {DEED_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setPreviews(null);
                setDeedType(t);
              }}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                deedType === t ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {DEED_LABELS[t]}
            </button>
          ))}
        </div>
        {batchMode && (
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewLoading}
            className="shrink-0 rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {previewLoading ? "Loading…" : "Preview resolved values"}
          </button>
        )}
      </div>

      {/* Recording & Return */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Recording &amp; Return Information</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2 rounded-md border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Drafted By</p>
            <Field label="Name" value={fields.drafter_name} onChange={set("drafter_name")} />
            <Field label="Address" value={fields.drafter_address} onChange={set("drafter_address")} />
            <Field label="City, State ZIP" value={fields.drafter_csz} onChange={set("drafter_csz")} />
          </div>
          <div className="space-y-2 rounded-md border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Return To</p>
            <Field label="Name" value={fields.return_name} onChange={set("return_name")} />
            <Field label="Address" value={fields.return_address} onChange={set("return_address")} />
            <Field label="City, State ZIP" value={fields.return_csz} onChange={set("return_csz")} />
          </div>
          {family === "standard" && (
            <div className="space-y-2 rounded-md border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tax Bills To</p>
              <Field label="Name" value={fields.tax_name} onChange={set("tax_name")} />
              <Field label="Address" value={fields.tax_address} onChange={set("tax_address")} />
              <Field label="City, State ZIP" value={fields.tax_csz} onChange={set("tax_csz")} />
            </div>
          )}
        </div>
      </div>

      {/* Grantor / Seller-Assignor */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {family === "lca" ? "Seller-Assignor (Transferring Party)" : "Grantor (Transferring Party)"}
        </h3>
        {batchMode ? (
          <div className="space-y-3">
            <PerContractNote text="Name, entity type, and address are pulled automatically from each selected contract's current lender." />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Signatory Name" value={fields.signatory_name} onChange={set("signatory_name")} required />
              <Field label="Signatory Title" value={fields.signatory_title} onChange={set("signatory_title")} placeholder="e.g. Manager, Trustee, Owner" />
            </div>
            <p className="text-xs text-slate-500">
              Who is actually signing on the lender&apos;s behalf isn&apos;t part of the contract record — applied to every document in
              this batch.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Full Name / Entity Name" value={fields.grantor_name} onChange={set("grantor_name")} required />
            <TypeSelect label="Entity Type" value={fields.grantor_type} onChange={set("grantor_type")} required={family !== "qcdlc"} />
            <div className="sm:col-span-2">
              <Field label="Mailing Address" value={fields.grantor_address} onChange={set("grantor_address")} placeholder="Street, City, State ZIP" required />
            </div>
            <Field label="Signatory Name" value={fields.signatory_name} onChange={set("signatory_name")} required />
            <Field label="Signatory Title" value={fields.signatory_title} onChange={set("signatory_title")} placeholder="e.g. Manager, Trustee, Owner" />
          </div>
        )}
      </div>

      {/* Grantee / Assignee */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {family === "lca" ? "Assignee (Receiving Party)" : "Grantee (Receiving Party)"}
        </h3>
        {batchMode && granteeIsPerContract ? (
          <div className="space-y-3">
            <PerContractNote text="Name and address are pulled automatically from each selected contract's own borrower — the homeowner receiving title on payoff." />
            <TypeSelect label="Entity Type" value={fields.grantee_type} onChange={set("grantee_type")} required />
            <p className="text-xs text-slate-500">
              A buyer&apos;s record only distinguishes individual vs. business — for joint owners, pick how they should be described
              (e.g. &quot;a married couple,&quot; joint tenants) before generating. Applied to every document in this batch.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Full Name / Entity Name" value={fields.grantee_name} onChange={set("grantee_name")} required />
            {family !== "qcdlc" && <TypeSelect label="Entity Type" value={fields.grantee_type} onChange={set("grantee_type")} required={family === "lca"} />}
            <div className="sm:col-span-2">
              <Field label="Mailing Address" value={fields.grantee_address} onChange={set("grantee_address")} placeholder="Street, City, State ZIP" required />
            </div>
            {family === "lca" && (
              <>
                <Field label="Assignee Signatory Name" value={fields.assignee_signatory_name} onChange={set("assignee_signatory_name")} />
                <Field label="Assignee Signatory Title" value={fields.assignee_signatory_title} onChange={set("assignee_signatory_title")} />
              </>
            )}
          </div>
        )}
      </div>

      {/* Underlying LC Buyer — QCDLC + LCA only */}
      {(family === "qcdlc" || family === "lca") && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-700">Existing Land Contract Buyer</h3>
          {batchMode ? (
            <PerContractNote text="Pulled automatically from each selected contract's borrower." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Buyer Name" value={fields.buyer_name} onChange={set("buyer_name")} required />
              <Field label="Buyer Address" value={fields.buyer_address} onChange={set("buyer_address")} />
            </div>
          )}
        </div>
      )}

      {/* Date & Consideration */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {family === "lca" ? "Signing Date" : "Deed Date & Consideration"}
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {family === "lca" && <Field label="Effective Date" value={fields.effective_date} onChange={set("effective_date")} type="date" />}
          <Field label={family === "lca" ? "Signing / Dated Date" : "Deed Date"} value={fields.deed_date} onChange={set("deed_date")} type="date" required />
          {family !== "lca" && deedType !== "WDS" && (
            <div className="sm:col-span-2">
              <Field label="Consideration" value={fields.consideration} onChange={set("consideration")} required={family !== "qcdlc"} />
            </div>
          )}
          {deedType === "WDS" && (
            <div className="flex items-center sm:col-span-2">
              <PerContractNote text="Consideration is set automatically to match the Sale Price entered below — no need to type it here." />
            </div>
          )}
        </div>
      </div>

      {/* Sale Price & Transfer Tax — WDS + QCDLC */}
      {(deedType === "WDS" || deedType === "QCDLC") && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-700">Sale Price &amp; Transfer Tax</h3>
          {salePriceIsPerContract ? (
            <PerContractNote text="Pulled automatically from each selected contract's original purchase price (not the current payoff balance) — transfer tax is computed per contract from that amount. Use Preview below to check the actual numbers before generating." />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Sale Price ($)" value={fields.sale_price} onChange={handleSalePriceChange} type="number" required />
                {salePriceCents > 0 && (
                  <div className="rounded-md border border-emerald-200 bg-white p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">State Transfer Tax</span>
                      <span className="font-medium tabular-nums">{formatCents(transferTax.stateTaxCents)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">County Transfer Tax</span>
                      <span className="font-medium tabular-nums">{formatCents(transferTax.countyTaxCents)}</span>
                    </div>
                    <div className="mt-1 flex justify-between border-t border-emerald-100 pt-1 font-semibold">
                      <span>Total</span>
                      <span className="tabular-nums">{formatCents(transferTax.totalTaxCents)}</span>
                    </div>
                  </div>
                )}
              </div>
              {batchMode && <p className="mt-2 text-xs text-amber-700">Applied identically to every document in this batch.</p>}
            </>
          )}
        </div>
      )}

      {/* Land Contract Interest details — LC only */}
      {deedType === "LC" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-700">Land Contract Details</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Interest Being Conveyed</label>
              <select value={fields.lc_interest} onChange={(e) => set("lc_interest")(e.target.value)} className={inputClass}>
                <option value="">-- Select --</option>
                <option value="vendor's interest">Vendor&apos;s Interest</option>
                <option value="vendee's interest">Vendee&apos;s Interest</option>
              </select>
            </div>
            {batchMode ? (
              <div className="sm:col-span-2 flex items-center">
                <PerContractNote text="Land Contract Date is pulled automatically from each selected contract." />
              </div>
            ) : (
              <Field label="Land Contract Date" value={fields.lc_date} onChange={set("lc_date")} type="date" required />
            )}
            <Field label="Recording Date" value={fields.lc_recording_date} onChange={set("lc_recording_date")} type="date" />
            <Field label="Liber" value={fields.lc_liber} onChange={set("lc_liber")} />
            <Field label="Page" value={fields.lc_page} onChange={set("lc_page")} />
          </div>
        </div>
      )}

      {/* Assignment recording details — QCDLC only */}
      {deedType === "QCDLC" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-700">Assignment of Land Contract</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {!batchMode && <Field label="Land Contract Date" value={fields.lc_date} onChange={set("lc_date")} type="date" />}
            <Field label="Assignment Recording County" value={fields.assignment_county} onChange={set("assignment_county")} />
            <Field label="Assignment Liber" value={fields.assignment_liber} onChange={set("assignment_liber")} />
            <Field label="Assignment Page" value={fields.assignment_page} onChange={set("assignment_page")} />
            <Field label="Acknowledgment Date" value={fields.ack_date} onChange={set("ack_date")} type="date" placeholder="Defaults to Deed Date" />
            <Field label="Acknowledgment County" value={fields.ack_county} onChange={set("ack_county")} placeholder="Defaults to County below" />
          </div>
        </div>
      )}

      {/* LCA-specific financial details */}
      {family === "lca" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-700">Land Contract Financial Details</h3>
          {batchMode ? (
            <PerContractNote text="Land Contract Date, Balance, Interest Rate, and Interest Paid Through are all pulled automatically from each selected contract." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Land Contract Date" value={fields.lc_date} onChange={set("lc_date")} type="date" required />
              <Field label="Outstanding Principal Balance ($)" value={fields.lc_balance} onChange={set("lc_balance")} />
              <Field label="Interest Rate (%)" value={fields.interest_rate} onChange={set("interest_rate")} />
              <Field label="Interest Paid Through" value={fields.interest_paid_through} onChange={set("interest_paid_through")} placeholder="e.g. August 1, 2026" />
            </div>
          )}
        </div>
      )}

      {/* Property Description */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Property Description</h3>
        {batchMode ? (
          <PerContractNote text="Location, county, address, parcel ID(s), and legal description are all pulled automatically from each selected contract's property." />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {family !== "lca" && (
                <div>
                  <label className={labelClass}>Location Type</label>
                  <div className="flex gap-1">
                    {["Township", "City", "Village"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => set("loc_type")(t)}
                        className={`flex-1 rounded-md border px-2 py-1.5 text-sm ${
                          fields.loc_type === t ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-600"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Field label={family === "lca" ? "City" : "Location Name"} value={fields.loc_name} onChange={set("loc_name")} required placeholder="e.g. Shelby Township" />
              <Field label="County" value={fields.county} onChange={set("county")} required />
              <div className="sm:col-span-3">
                <Field label="Street Address (Commonly Known As)" value={fields.street_address} onChange={set("street_address")} required />
              </div>
              <div className="sm:col-span-3">
                <Field label="Tax Parcel ID(s)" value={fields.parcel_ids} onChange={set("parcel_ids")} required />
              </div>
            </div>
            <div className="mt-3">
              <label className={labelClass}>
                Full Legal Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={fields.legal_description}
                onChange={(e) => set("legal_description")(e.target.value)}
                rows={5}
                className={inputClass}
              />
            </div>
          </>
        )}
      </div>

      {/* Transfer Tax Exemptions — QCD/WD/LC only (WDS is a taxable sale) */}
      {family === "standard" && deedType !== "WDS" && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Transfer Tax Exemptions</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="State — MCL 207.505(__)" value={fields.mcl_state} onChange={set("mcl_state")} />
            <Field label="County — MCL 207.526(__)" value={fields.mcl_county} onChange={set("mcl_county")} />
          </div>
        </div>
      )}

      {/* Notary — standard family */}
      {family === "standard" && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Notary Acknowledgment</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Field label="Day" value={fields.notary_day} onChange={set("notary_day")} type="number" placeholder="Defaults to Deed Date" />
            <div>
              <label className={labelClass}>Month</label>
              <select value={fields.notary_month} onChange={(e) => set("notary_month")(e.target.value)} className={inputClass}>
                <option value="">-- Month --</option>
                {MONTH_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <Field label="Year" value={fields.notary_year} onChange={set("notary_year")} type="number" placeholder="Defaults to Deed Date" />
            <Field label="Notary Printed Name" value={fields.notary_name} onChange={set("notary_name")} />
            <Field label="Notary County" value={fields.notary_county} onChange={set("notary_county")} />
            <Field label="Acting in County" value={fields.acting_county} onChange={set("acting_county")} />
            <Field label="Commission Expires" value={fields.commission_expires} onChange={set("commission_expires")} placeholder="e.g. October 15, 2028" />
          </div>
        </div>
      )}

      {/* Notary — LCA family (both parties) */}
      {family === "lca" && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Notary Acknowledgment</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 rounded-md border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Seller-Assignor</p>
              <Field label="Notary State" value={fields.notary_state} onChange={set("notary_state")} />
              <Field label="Notary County" value={fields.notary_county} onChange={set("notary_county")} />
              <Field label="Commission Expires" value={fields.commission_expires} onChange={set("commission_expires")} />
            </div>
            <div className="space-y-2 rounded-md border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assignee</p>
              <Field label="Notary State" value={fields.assignee_notary_state} onChange={set("assignee_notary_state")} />
              <Field label="Notary County" value={fields.assignee_notary_county} onChange={set("assignee_notary_county")} />
              <Field label="Acknowledgment Date" value={fields.assignee_ack_date} onChange={set("assignee_ack_date")} type="date" placeholder="Defaults to Signing Date" />
              <Field label="Commission Expires" value={fields.assignee_commission_expires} onChange={set("assignee_commission_expires")} />
            </div>
          </div>
        </div>
      )}

      <div className="sticky bottom-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="rounded-md bg-slate-900 px-6 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {generating
            ? "Generating…"
            : batchMode
            ? `Generate ${selectedContractIds.size} ${DEED_LABELS[deedType]} Document${selectedContractIds.size === 1 ? "" : "s"} (.docx${
                selectedContractIds.size > 1 ? "s in a .zip" : ""
              })`
            : `Generate ${DEED_LABELS[deedType]} (.docx)`}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-700">{success}</p>}
      </div>
    </div>
  );
}
