"use client";

import { useActionState, useState } from "react";
import {
  updateLenderSensitiveInfo,
  revealLenderTaxId,
  revealLenderAchAccount,
  type UpdateSensitiveInfoState,
} from "../actions";

function RevealField({
  label,
  last4,
  onReveal,
}: {
  label: string;
  last4: string | null;
  onReveal: () => Promise<string | null>;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!last4) {
    return (
      <div className="flex items-baseline justify-between py-1 text-sm">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-400">Not on file</span>
      </div>
    );
  }

  return (
    <div className="flex items-baseline justify-between py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-medium tabular-nums text-slate-900">{revealed ?? `••••${last4}`}</span>
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            if (revealed) {
              setRevealed(null);
              return;
            }
            setLoading(true);
            const value = await onReveal();
            setRevealed(value);
            setLoading(false);
          }}
          className="text-xs font-medium text-blue-700 hover:underline disabled:opacity-50"
        >
          {loading ? "..." : revealed ? "Hide" : "Reveal"}
        </button>
      </span>
    </div>
  );
}

export default function SensitiveInfoSection({
  lenderId,
  taxIdLast4,
  achBankName,
  achRoutingNumber,
  achAccountLast4,
}: {
  lenderId: string;
  taxIdLast4: string | null;
  achBankName: string | null;
  achRoutingNumber: string | null;
  achAccountLast4: string | null;
}) {
  const action = updateLenderSensitiveInfo.bind(null, lenderId);
  const [state, formAction, pending] = useActionState<UpdateSensitiveInfoState | undefined, FormData>(action, undefined);

  return (
    <div className="rounded-lg border border-slate-200 shadow-sm p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">SSN/TIN &amp; ACH Banking</h3>

      <RevealField label="SSN / TIN" last4={taxIdLast4} onReveal={() => revealLenderTaxId(lenderId)} />
      <div className="flex items-baseline justify-between py-1 text-sm">
        <span className="text-slate-500">Bank Name</span>
        <span className="font-medium text-slate-900">{achBankName ?? "—"}</span>
      </div>
      <div className="flex items-baseline justify-between py-1 text-sm">
        <span className="text-slate-500">Routing Number</span>
        <span className="font-medium tabular-nums text-slate-900">{achRoutingNumber ?? "—"}</span>
      </div>
      <RevealField label="Account Number" last4={achAccountLast4} onReveal={() => revealLenderAchAccount(lenderId)} />

      <form action={formAction} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-400">
          Leave the SSN/TIN or Account Number blank to keep the value already on file — only fill them in to replace it.
        </p>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="taxId">
            New SSN / TIN
          </label>
          <input
            id="taxId"
            name="taxId"
            type="text"
            placeholder="•••••••••"
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="achBankName">
              Bank Name
            </label>
            <input
              id="achBankName"
              name="achBankName"
              type="text"
              defaultValue={achBankName ?? ""}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="achRoutingNumber">
              Routing Number
            </label>
            <input
              id="achRoutingNumber"
              name="achRoutingNumber"
              type="text"
              defaultValue={achRoutingNumber ?? ""}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="achAccountNumber">
            New Account Number
          </label>
          <input
            id="achAccountNumber"
            name="achAccountNumber"
            type="text"
            placeholder="•••••••••"
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center justify-between">
          {state?.success && <p className="text-sm text-emerald-700">{state.success}</p>}
          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="ml-auto rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
