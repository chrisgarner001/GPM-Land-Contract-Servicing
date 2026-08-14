"use client";

import { useActionState, useMemo, useState } from "react";
import { createInvoiceAction, type CreateInvoiceState } from "../actions";
import { formatCents } from "@/lib/format";
import { GL_CODE_TYPE_LABELS } from "@/app/setup/gl-codes/glCodeTypeLabels";

interface VendorOption {
  id: string;
  displayName: string;
  defaultGlCode: string | null;
}

interface ContractOption {
  id: string;
  contractNumber: string;
  buyerName: string | null;
  currentEscrowBalanceCents: number;
  currentLenders: { displayName: string; ownershipPercent: string }[];
}

interface GlCodeOption {
  code: string;
  description: string | null;
  type: string | null;
}

export default function NewInvoiceForm({
  vendorOptions,
  contractOptions,
  glCodeOptions,
  defaultVendorId,
}: {
  vendorOptions: VendorOption[];
  contractOptions: ContractOption[];
  glCodeOptions: GlCodeOption[];
  defaultVendorId?: string;
}) {
  const [state, formAction, pending] = useActionState<CreateInvoiceState | undefined, FormData>(
    createInvoiceAction,
    undefined
  );

  const [vendorMode, setVendorMode] = useState<"existing" | "new">("existing");
  const [applyMode, setApplyMode] = useState<"ESCROW" | "CHARGE_LENDER">("ESCROW");
  const [contractId, setContractId] = useState("");
  const [amountDollars, setAmountDollars] = useState("");
  const [existingVendorId, setExistingVendorId] = useState(defaultVendorId ?? "");
  const [glCode, setGlCode] = useState(
    () => vendorOptions.find((v) => v.id === defaultVendorId)?.defaultGlCode ?? ""
  );

  function handlePickVendor(vendorId: string) {
    setExistingVendorId(vendorId);
    const defaultGlCode = vendorOptions.find((v) => v.id === vendorId)?.defaultGlCode;
    if (defaultGlCode) setGlCode(defaultGlCode);
  }

  const selectedContract = useMemo(() => contractOptions.find((c) => c.id === contractId) ?? null, [contractId, contractOptions]);
  const amountCents = Math.round(Number(amountDollars) * 100) || 0;
  const balanceAfterCents = selectedContract ? selectedContract.currentEscrowBalanceCents - amountCents : null;

  const glCodeGroups = useMemo(() => {
    const groups = new Map<string, GlCodeOption[]>();
    for (const g of glCodeOptions) {
      const key = g.type ? GL_CODE_TYPE_LABELS[g.type] ?? g.type : "Uncategorized";
      const list = groups.get(key) ?? [];
      list.push(g);
      groups.set(key, list);
    }
    return Array.from(groups.entries());
  }, [glCodeOptions]);

  return (
    <form action={formAction} className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <div className="mb-2 flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="vendorMode"
              value="existing"
              checked={vendorMode === "existing"}
              onChange={() => setVendorMode("existing")}
            />
            Existing Vendor
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="vendorMode"
              value="new"
              checked={vendorMode === "new"}
              onChange={() => setVendorMode("new")}
            />
            New Vendor
          </label>
        </div>

        {vendorMode === "existing" ? (
          <select
            name="existingVendorId"
            required
            value={existingVendorId}
            onChange={(e) => handlePickVendor(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="" disabled>
              Select a vendor…
            </option>
            {vendorOptions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.displayName}
              </option>
            ))}
          </select>
        ) : (
          <input
            name="newVendorName"
            type="text"
            required
            placeholder="Vendor name"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="contractId">
          Land Contract
        </label>
        <select
          id="contractId"
          name="contractId"
          required
          value={contractId}
          onChange={(e) => setContractId(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="" disabled>
            Select a land contract…
          </option>
          {contractOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.contractNumber}
              {c.buyerName ? ` — ${c.buyerName}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Apply To</label>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="applyMode"
              value="ESCROW"
              checked={applyMode === "ESCROW"}
              onChange={() => setApplyMode("ESCROW")}
            />
            Escrow Balance
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="applyMode"
              value="CHARGE_LENDER"
              checked={applyMode === "CHARGE_LENDER"}
              onChange={() => setApplyMode("CHARGE_LENDER")}
            />
            Charge Lender
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="amount">
            Amount ($)
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amountDollars}
            onChange={(e) => setAmountDollars(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="dueDate">
            Due Date
          </label>
          <input
            id="dueDate"
            name="dueDate"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="paymentMethod">
          Payment Method
        </label>
        <select
          id="paymentMethod"
          name="paymentMethod"
          defaultValue="CHECK"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="CHECK">Check</option>
          <option value="ACH">ACH</option>
          <option value="PAID_ONLINE">Paid Online</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="reference">
            Account Number / Reference
          </label>
          <input
            id="reference"
            name="reference"
            type="text"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="glCode">
            GL Code
          </label>
          <select
            id="glCode"
            name="glCode"
            required
            value={glCode}
            onChange={(e) => setGlCode(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="" disabled>
              Select a GL code…
            </option>
            {glCodeGroups.map(([groupLabel, codes]) => (
              <optgroup key={groupLabel} label={groupLabel}>
                {codes.map((g) => (
                  <option key={g.code} value={g.code}>
                    {g.code}
                    {g.description ? ` — ${g.description}` : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {glCodeOptions.length === 0 && (
            <p className="mt-1 text-xs text-slate-400">
              No GL codes yet — add some under Setup &gt; GL Codes.
            </p>
          )}
        </div>
      </div>

      {selectedContract && applyMode === "ESCROW" && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-slate-500">Current Escrow Balance</span>
            <span className="tabular-nums text-slate-900">{formatCents(selectedContract.currentEscrowBalanceCents)}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-slate-500">Balance After Invoice</span>
            <span
              className={`font-medium tabular-nums ${
                balanceAfterCents !== null && balanceAfterCents < 0 ? "text-red-700" : "text-slate-900"
              }`}
            >
              {balanceAfterCents !== null ? formatCents(balanceAfterCents) : "—"}
            </span>
          </div>
        </div>
      )}

      {selectedContract && applyMode === "CHARGE_LENDER" && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          {selectedContract.currentLenders.length === 0 ? (
            <p className="text-amber-800">
              No active lender is currently funding this contract — Charge Lender isn&apos;t available.
            </p>
          ) : (
            <>
              <p className="mb-1 text-slate-500">This will charge the borrower&apos;s contract and debit:</p>
              <ul className="space-y-0.5">
                {selectedContract.currentLenders.map((l) => (
                  <li key={l.displayName} className="flex items-baseline justify-between">
                    <span className="text-slate-700">{l.displayName}</span>
                    <span className="tabular-nums text-slate-900">{Number(l.ownershipPercent).toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-700">{state.success}</p>}

      <button
        type="submit"
        disabled={pending || (applyMode === "CHARGE_LENDER" && !!selectedContract && selectedContract.currentLenders.length === 0)}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save Invoice"}
      </button>
    </form>
  );
}
