"use client";

import { useState, useTransition } from "react";
import { revealBankAccountNumber, removeBankAccount } from "../actions";

interface BankAccountRow {
  id: string;
  label: string;
  bankName: string | null;
  routingNumber: string | null;
  accountNumberLast4: string | null;
  notes: string | null;
}

function RevealCell({ id, last4 }: { id: string; last4: string | null }) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!last4) return <span className="text-slate-400">Not on file</span>;

  return (
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
          const value = await revealBankAccountNumber(id);
          setRevealed(value);
          setLoading(false);
        }}
        className="text-xs font-medium text-blue-700 hover:underline disabled:opacity-50"
      >
        {loading ? "..." : revealed ? "Hide" : "Reveal"}
      </button>
    </span>
  );
}

function RemoveButton({ id, label }: { id: string; label: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Remove the "${label}" bank account? Any vendor or lender currently defaulting to it will be unassigned.`)) {
          return;
        }
        startTransition(async () => {
          await removeBankAccount(id);
        });
      }}
      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
    >
      {pending ? "Removing..." : "Remove"}
    </button>
  );
}

export default function BankAccountsList({ rows }: { rows: BankAccountRow[] }) {
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-slate-400">No bank accounts on record yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <th className="px-4 py-3">Label</th>
          <th className="px-4 py-3">Bank</th>
          <th className="px-4 py-3">Routing #</th>
          <th className="px-4 py-3">Account #</th>
          <th className="px-4 py-3">Notes</th>
          <th className="px-4 py-3"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((a) => (
          <tr key={a.id}>
            <td className="px-4 py-3 font-medium text-slate-900">{a.label}</td>
            <td className="px-4 py-3 text-slate-600">{a.bankName ?? "—"}</td>
            <td className="px-4 py-3 tabular-nums text-slate-600">{a.routingNumber ?? "—"}</td>
            <td className="px-4 py-3">
              <RevealCell id={a.id} last4={a.accountNumberLast4} />
            </td>
            <td className="px-4 py-3 text-slate-500">{a.notes ?? "—"}</td>
            <td className="px-4 py-3 text-right">
              <RemoveButton id={a.id} label={a.label} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
