"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { makePayment, type MakePaymentState } from "../actions";
import { applyPayment } from "@/domain/ledger/applyPayment";
import { computeReleaseDate } from "@/domain/ledger/computeReleaseDate";
import { formatCents, formatDate, formatPercent } from "@/lib/format";

// Fields with no real data/logic behind them yet — shown to match TMO's
// layout, but inert until their underlying feature exists:
//   - Unpaid Interest: needs the persistent unpaid-balance ledger (planned,
//     pending a TMO export to seed starting values) — task #44.
//   - From Impound / Other Payments / Lender Fees / Broker Fees: no source
//     of funds or distribution target exists for these in the domain model.
// Release Date IS real now (see computeReleaseDate) — this preview mirrors
// exactly what recordPayment stamps on the payment row server-side.
export default function RecordPaymentModal({
  contractId,
  contractNumber,
  borrowerName,
  currentPrincipalBalanceCents,
  reserveBalanceCents,
  escrowBalanceCents,
  regularPaymentTotalCents,
  regularPaymentAmountCents,
  paidToDate,
  nextPaymentDate,
  maturityDate,
  annualRatePercent,
  amountDueCents,
  lateFeeCents,
  isLate,
  defaultEscrowPortionCents,
  unpaidChargesCents,
}: {
  contractId: string;
  contractNumber: string;
  borrowerName: string;
  currentPrincipalBalanceCents: number;
  reserveBalanceCents: number;
  escrowBalanceCents: number | null;
  regularPaymentTotalCents: number;
  regularPaymentAmountCents: number;
  paidToDate: string | null;
  nextPaymentDate: string | null;
  maturityDate: string | null;
  annualRatePercent: number;
  amountDueCents: number;
  lateFeeCents: number;
  isLate: boolean;
  defaultEscrowPortionCents: number;
  unpaidChargesCents: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const action = makePayment.bind(null, contractId);
  const [state, formAction, pending] = useActionState<MakePaymentState | undefined, FormData>(action, undefined);

  const today = new Date().toISOString().slice(0, 10);
  const defaultAmountDollars = (amountDueCents / 100).toFixed(2);
  const defaultEscrowDollars = (defaultEscrowPortionCents / 100).toFixed(2);
  const defaultLateFeeDollars = ((isLate ? lateFeeCents : 0) / 100).toFixed(2);

  const [amountDollars, setAmountDollars] = useState(defaultAmountDollars);
  const [escrowDollars, setEscrowDollars] = useState(defaultEscrowDollars);
  const [lateFeeDollars, setLateFeeDollars] = useState(defaultLateFeeDollars);
  const [chargePaymentDollars, setChargePaymentDollars] = useState("0.00");
  const [applyReserve, setApplyReserve] = useState(false);
  const [receivedDate, setReceivedDate] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState("CHECK");
  const [referenceNumber, setReferenceNumber] = useState("");

  function resetFields() {
    setAmountDollars(defaultAmountDollars);
    setEscrowDollars(defaultEscrowDollars);
    setLateFeeDollars(defaultLateFeeDollars);
    setChargePaymentDollars("0.00");
    setApplyReserve(false);
    setReceivedDate(today);
    setPaymentMethod("CHECK");
    setReferenceNumber("");
  }

  useEffect(() => {
    // Closing triggers the dialog's onClose handler, which resets the form —
    // no need to reset state here too.
    if (state?.success) {
      dialogRef.current?.close();
    }
  }, [state]);

  const breakdown = useMemo(() => {
    const paymentAmountCents = Math.round(Number(amountDollars) * 100);
    const escrowPortionCents = Math.round(Number(escrowDollars) * 100);
    const lateFeeOverrideCents = Math.round(Number(lateFeeDollars) * 100);
    const chargePaymentCents = Math.round(Number(chargePaymentDollars) * 100);
    if (!Number.isFinite(paymentAmountCents) || paymentAmountCents <= 0) return null;

    const result = applyPayment({
      paymentAmountCents,
      currentPrincipalBalanceCents,
      annualRatePercent,
      regularPaymentAmountCents,
      existingReserveBalanceCents: applyReserve ? reserveBalanceCents : 0,
      escrowPortionCents: Number.isFinite(escrowPortionCents) ? escrowPortionCents : 0,
      lateFeeCents: Number.isFinite(lateFeeOverrideCents) ? Math.max(0, lateFeeOverrideCents) : 0,
      chargePaymentCents: Number.isFinite(chargePaymentCents) ? Math.max(0, chargePaymentCents) : 0,
    });

    const sum = (type: string) => result.allocations.filter((a) => a.type === type).reduce((s, a) => s + a.amountCents, 0);
    // A single applyPayment call only ever produces one SUSPENSE allocation —
    // negative when reserve is drawn into this payment, positive when this
    // payment (or the excess of it) is held for next time.
    const suspenseSum = sum("SUSPENSE");
    return {
      heldInReserve: result.heldInReserve,
      principalCents: sum("PRINCIPAL"),
      interestCents: sum("INTEREST"),
      escrowCents: sum("ESCROW_TAX"),
      lateFeeCents: sum("LATE_FEE"),
      chargeAppliedCents: sum("OTHER_FEE"),
      reserveDrawnCents: Math.max(0, -suspenseSum),
      reserveHeldCents: Math.max(0, suspenseSum),
    };
  }, [
    amountDollars,
    escrowDollars,
    lateFeeDollars,
    chargePaymentDollars,
    applyReserve,
    currentPrincipalBalanceCents,
    annualRatePercent,
    regularPaymentAmountCents,
    reserveBalanceCents,
  ]);

  const enteredAmountCents = Math.round(Number(amountDollars) * 100) || 0;
  const reserveDrawnCents = applyReserve ? (breakdown?.reserveDrawnCents ?? 0) : 0;
  const totalReceivedCents = enteredAmountCents + reserveDrawnCents;

  const releaseDateDisplay = (() => {
    if (Number.isNaN(new Date(`${receivedDate}T00:00:00Z`).getTime())) return "—";
    return formatDate(computeReleaseDate(receivedDate));
  })();

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Record Payment
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-full max-w-3xl rounded-lg border border-slate-200 p-0 shadow-xl backdrop:bg-slate-900/40"
        onClose={resetFields}
      >
        <form action={formAction} className="max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Record Payment</h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="space-y-5 p-5">
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Loan Information</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                <ModalField label="Account" value={contractNumber} />
                <ModalField label="Borrower" value={borrowerName} />
                <ModalField label="Note Rate" value={formatPercent(annualRatePercent)} />
                <ModalField label="Principal Balance" value={formatCents(currentPrincipalBalanceCents)} />
                <ModalField label="Reserve Balance" value={formatCents(Math.max(0, reserveBalanceCents))} />
                <ModalField label="Impound Balance" value={formatCents(escrowBalanceCents)} />
                <ModalField label="Unpaid Interest" value={formatCents(0)} />
                <ModalField label="Unpaid Late Chgs" value={formatCents(0)} />
                <ModalField label="Unpaid Charges" value={formatCents(unpaidChargesCents)} />
                <ModalField label="Regular Payment" value={formatCents(regularPaymentTotalCents)} />
                <ModalField label="Paid to Date" value={formatDate(paidToDate)} />
                <ModalField label="Next Payment Due" value={formatDate(nextPaymentDate)} />
                <ModalField label="Next Revision" value="—" />
                <ModalField label="Maturity Date" value={formatDate(maturityDate)} />
                {isLate && lateFeeCents > 0 && (
                  <ModalField label="Add Late Charge" value={formatCents(lateFeeCents)} />
                )}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Payment Information</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500" htmlFor="paymentMethod">
                    Method
                  </label>
                  <select
                    id="paymentMethod"
                    name="paymentMethod"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="CHECK">Check</option>
                    <option value="CASH">Cash</option>
                    <option value="ACH">ACH</option>
                    <option value="CARD">Card</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500" htmlFor="referenceNumber">
                    Reference
                  </label>
                  <input
                    id="referenceNumber"
                    name="referenceNumber"
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <ModalField label="Date Due" value={formatDate(nextPaymentDate)} />
                <div>
                  <label className="mb-1 block text-xs text-slate-500" htmlFor="receivedDate">
                    Date Received
                  </label>
                  <input
                    id="receivedDate"
                    name="receivedDate"
                    type="date"
                    required
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <ModalField label="Release Date" value={releaseDateDisplay} />
                <ModalField label="Release Status" value="Release" />
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Source of Funds</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs text-slate-500" htmlFor="amount">
                    From Borrower ($)
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
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs text-slate-500" htmlFor="applyReserve">
                    <input
                      id="applyReserve"
                      type="checkbox"
                      name="applyReserve"
                      value="1"
                      checked={applyReserve}
                      onChange={(e) => setApplyReserve(e.target.checked)}
                      disabled={reserveBalanceCents <= 0}
                      className="h-3.5 w-3.5 rounded border-slate-300"
                    />
                    From Reserve
                  </label>
                  <p className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm tabular-nums text-slate-700">
                    {formatCents(reserveDrawnCents)}
                  </p>
                </div>
                <ModalField label="From Impound" value={formatCents(0)} />
                <ModalField label="Total Received" value={formatCents(totalReceivedCents)} emphasize />
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Payment Distribution</h3>
              {breakdown === null ? (
                <p className="text-sm text-slate-400">Enter an amount above to see the distribution.</p>
              ) : breakdown.heldInReserve ? (
                <p className="text-sm text-amber-700">
                  This amount is less than a full payment and will be held in reserve — no principal, interest, or
                  late charge applied yet.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <ModalField label="Principal" value={formatCents(breakdown.principalCents)} />
                  <ModalField label="Interest" value={formatCents(breakdown.interestCents)} />
                  <div>
                    <label className="mb-1 block text-xs text-slate-500" htmlFor="lateFee">
                      Late Charges ($)
                    </label>
                    <input
                      id="lateFee"
                      name="lateFee"
                      type="number"
                      step="0.01"
                      min="0"
                      value={lateFeeDollars}
                      onChange={(e) => setLateFeeDollars(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <ModalField label="Reserve" value={formatCents(breakdown.reserveHeldCents)} />
                  <div>
                    <label className="mb-1 block text-xs text-slate-500" htmlFor="escrowPortion">
                      Impound ($)
                    </label>
                    <input
                      id="escrowPortion"
                      name="escrowPortion"
                      type="number"
                      step="0.01"
                      min="0"
                      value={escrowDollars}
                      onChange={(e) => setEscrowDollars(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <ModalField label="Unpaid Interest" value={formatCents(0)} />
                  {unpaidChargesCents > 0 ? (
                    <div>
                      <label className="mb-1 block text-xs text-slate-500" htmlFor="chargePayment">
                        Pay Charges ($)
                      </label>
                      <input
                        id="chargePayment"
                        name="chargePayment"
                        type="number"
                        step="0.01"
                        min="0"
                        max={(unpaidChargesCents / 100).toFixed(2)}
                        value={chargePaymentDollars}
                        onChange={(e) => setChargePaymentDollars(e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  ) : (
                    <ModalField label="Pay Charges" value={formatCents(0)} />
                  )}
                  <ModalField label="Other Payments" value={formatCents(0)} />
                  <ModalField label="Lender Fees" value={formatCents(0)} />
                  <ModalField label="Broker Fees" value={formatCents(0)} />
                </div>
              )}
            </section>

            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
            <button type="button" onClick={resetFields} className="text-xs font-medium text-slate-500 hover:text-slate-700">
              Clear &amp; Start Again
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {pending ? "Recording..." : "Record Payment"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function ModalField({ label, value, emphasize }: { label: string; value: React.ReactNode; emphasize?: boolean }) {
  return (
    <div className="py-1">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`tabular-nums text-slate-900 ${emphasize ? "font-semibold" : "font-medium"}`}>{value}</p>
    </div>
  );
}
