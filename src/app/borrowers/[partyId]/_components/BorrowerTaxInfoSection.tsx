"use client";

import { useActionState, useState } from "react";
import { updateBorrowerTaxInfo, revealBorrowerTaxId, type UpdateBorrowerTaxInfoState } from "../actions";

function RevealField({ label, last4, onReveal }: { label: string; last4: string | null; onReveal: () => Promise<string | null> }) {
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

export default function BorrowerTaxInfoSection({
  partyId,
  taxIdLast4,
  legalStructure,
  dateOfBirth,
  tinType,
  onHold,
  alternateTaxInfo,
  sendTaxReporting,
  sendLateNotices,
  sendPaymentReceipts,
  sendPaymentStatements,
}: {
  partyId: string;
  taxIdLast4: string | null;
  legalStructure: string | null;
  dateOfBirth: string | null;
  tinType: "SSN" | "EIN" | null;
  onHold: boolean;
  alternateTaxInfo: string | null;
  sendTaxReporting: boolean;
  sendLateNotices: boolean;
  sendPaymentReceipts: boolean;
  sendPaymentStatements: boolean;
}) {
  const action = updateBorrowerTaxInfo.bind(null, partyId);
  const [state, formAction, pending] = useActionState<UpdateBorrowerTaxInfoState | undefined, FormData>(action, undefined);

  return (
    <div className="rounded-lg border border-slate-200 shadow-sm p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Tax &amp; Notices</h3>

      <RevealField label="TIN" last4={taxIdLast4} onReveal={() => revealBorrowerTaxId(partyId)} />

      <form action={formAction} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-400">Leave TIN blank to keep the value already on file — only fill it in to replace it.</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="taxId">
              New TIN
            </label>
            <input
              id="taxId"
              name="taxId"
              type="text"
              placeholder="•••••••••"
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="tinType">
              TIN Type
            </label>
            <select
              id="tinType"
              name="tinType"
              defaultValue={tinType ?? "SSN"}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="SSN">SSN</option>
              <option value="EIN">EIN</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="legalStructure">
              Legal Structure
            </label>
            <select
              id="legalStructure"
              name="legalStructure"
              defaultValue={legalStructure ?? ""}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">—</option>
              <option value="Corporation">Corporation</option>
              <option value="Individual">Individual</option>
              <option value="LLC">LLC</option>
              <option value="LLP">LLP</option>
              <option value="Trust">Trust</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="dateOfBirth">
              Date of Birth
            </label>
            <input
              id="dateOfBirth"
              name="dateOfBirth"
              type="date"
              defaultValue={dateOfBirth ?? ""}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="alternateTaxInfo">
            Alternate Tax Info
          </label>
          <input
            id="alternateTaxInfo"
            name="alternateTaxInfo"
            type="text"
            defaultValue={alternateTaxInfo ?? ""}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <label className="flex items-center gap-1.5 text-sm text-slate-700">
          <input type="checkbox" name="onHold" value="1" defaultChecked={onHold} />
          Hold
        </label>

        <div>
          <p className="mb-1 text-xs text-slate-500">Notices &amp; Forms</p>
          <div className="grid grid-cols-2 gap-1 text-sm text-slate-700">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="sendTaxReporting" value="1" defaultChecked={sendTaxReporting} />
              Tax Reporting
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="sendLateNotices" value="1" defaultChecked={sendLateNotices} />
              Send Late Notices
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="sendPaymentReceipts" value="1" defaultChecked={sendPaymentReceipts} />
              Send Payment Receipts
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="sendPaymentStatements" value="1" defaultChecked={sendPaymentStatements} />
              Send Payment Statements
            </label>
          </div>
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
