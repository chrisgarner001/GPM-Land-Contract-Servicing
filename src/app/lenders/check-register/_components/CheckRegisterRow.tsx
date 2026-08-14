"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCents } from "@/lib/format";

interface LineItem {
  lineItemId: string;
  contractId: string | null;
  contractNumber: string | null;
  loanAccountRaw: string | null;
  amountCents: number;
  servicingFeeCents: number;
  interestCents: number;
  principalCents: number;
}

export default function CheckRegisterRow({
  checkDate,
  checkNumber,
  payeeName,
  payeeCode,
  totalAmountCents,
  lineItems,
}: {
  checkDate: string;
  checkNumber: string;
  payeeName: string;
  payeeCode: string;
  totalAmountCents: number;
  lineItems: LineItem[];
}) {
  const [open, setOpen] = useState(false);
  const hasMultiple = lineItems.length > 1;
  const single = lineItems.length === 1 ? lineItems[0] : null;

  const totalServicingFeeCents = lineItems.reduce((s, i) => s + i.servicingFeeCents, 0);
  const totalInterestCents = lineItems.reduce((s, i) => s + i.interestCents, 0);
  const totalPrincipalCents = lineItems.reduce((s, i) => s + i.principalCents, 0);

  return (
    <>
      <tr className="hover:bg-slate-50">
        <td className="px-4 py-3 text-slate-600">{checkDate}</td>
        <td className="px-4 py-3 text-slate-500">{checkNumber}</td>
        <td className="px-4 py-3 text-slate-700">
          {payeeName}
          <span className="ml-1 text-xs text-slate-400">({payeeCode})</span>
        </td>
        <td className="px-4 py-3">
          {hasMultiple ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
            >
              <svg
                className={`h-3 w-3 flex-shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Detail ({lineItems.length} LCs)
            </button>
          ) : single?.contractId ? (
            <Link href={`/contracts/${single.contractId}`} prefetch={false} className="font-medium text-blue-700 hover:underline">
              {single.contractNumber}
            </Link>
          ) : (
            <span className="text-slate-400">{single?.loanAccountRaw ?? "—"}</span>
          )}
        </td>
        <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">{formatCents(totalAmountCents)}</td>
        <td className="px-4 py-3 text-right tabular-nums text-slate-500">{formatCents(totalServicingFeeCents)}</td>
        <td className="px-4 py-3 text-right tabular-nums text-slate-500">{formatCents(totalInterestCents)}</td>
        <td className="px-4 py-3 text-right tabular-nums text-slate-500">{formatCents(totalPrincipalCents)}</td>
      </tr>
      {open &&
        hasMultiple &&
        lineItems.map((item) => (
          <tr key={item.lineItemId} className="bg-slate-50 text-xs">
            <td className="px-4 py-2" />
            <td className="px-4 py-2" />
            <td className="px-4 py-2 pl-8 text-slate-500">
              {item.contractId ? (
                <Link href={`/contracts/${item.contractId}`} prefetch={false} className="font-medium text-blue-700 hover:underline">
                  {item.contractNumber}
                </Link>
              ) : (
                item.loanAccountRaw ?? "—"
              )}
            </td>
            <td className="px-4 py-2" />
            <td className="px-4 py-2 text-right tabular-nums text-slate-700">{formatCents(item.amountCents)}</td>
            <td className="px-4 py-2 text-right tabular-nums text-slate-400">{formatCents(item.servicingFeeCents)}</td>
            <td className="px-4 py-2 text-right tabular-nums text-slate-400">{formatCents(item.interestCents)}</td>
            <td className="px-4 py-2 text-right tabular-nums text-slate-400">{formatCents(item.principalCents)}</td>
          </tr>
        ))}
    </>
  );
}
