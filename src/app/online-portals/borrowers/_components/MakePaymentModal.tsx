"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { initiateBorrowerPaymentAction, initiateBorrowerPrincipalPaydownAction } from "../actions";
import { formatCents } from "@/lib/format";

const HELCIM_SCRIPT_SRC = "https://secure.helcim.app/helcim-pay/services/start.js";

function loadHelcimScript(): Promise<void> {
  if (document.querySelector(`script[src="${HELCIM_SCRIPT_SRC}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = HELCIM_SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the payment form. Check your connection and try again."));
    document.body.appendChild(script);
  });
}

type Step = "closed" | "amount" | "submitting" | "modal" | "done";
type Mode = "payment" | "paydown";

export interface PaymentBreakdown {
  paymentAmountCents: number;
  lateFeeCents: number;
  escrowPortionCents: number;
  unpaidChargesCents: number;
  totalDueCents: number;
}

export interface PrincipalPaydownEligibility {
  eligible: boolean;
  reason: string | null;
}

export default function MakePaymentModal({
  currentBalanceCents,
  breakdown,
  principalPaydownEligibility,
}: {
  currentBalanceCents: number;
  breakdown: PaymentBreakdown;
  principalPaydownEligibility: PrincipalPaydownEligibility;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("closed");
  const [mode, setMode] = useState<Mode>("payment");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  function open() {
    setMode("payment");
    setAmount((breakdown.totalDueCents / 100).toFixed(2));
    setStep("amount");
  }

  function close() {
    setStep("closed");
    setAmount("");
    setError(null);
    setResultMessage(null);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setAmount(next === "payment" ? (breakdown.totalDueCents / 100).toFixed(2) : "");
  }

  async function handleContinue() {
    setError(null);
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    const amountCents = Math.round(dollars * 100);
    if (mode === "paydown" && amountCents > currentBalanceCents) {
      setError("Amount exceeds your outstanding principal balance.");
      return;
    }

    setStep("submitting");
    try {
      const initiate = mode === "payment" ? initiateBorrowerPaymentAction : initiateBorrowerPrincipalPaydownAction;
      const [{ checkoutToken }] = await Promise.all([initiate(amountCents), loadHelcimScript()]);

      const handleMessage = (event: MessageEvent) => {
        if (event.data?.eventName !== `helcim-pay-js-${checkoutToken}`) return;
        if (event.data.eventStatus === "HIDE") return;
        window.removeEventListener("message", handleMessage);

        if (event.data.eventStatus === "SUCCESS") {
          setResultMessage("Payment submitted — it will show as Pending in your payment history until it clears.");
        } else {
          setResultMessage("The payment wasn't completed. No charge was made — try again if this wasn't intentional.");
        }
        setStep("done");
        router.refresh();
      };
      window.addEventListener("message", handleMessage);

      setStep("modal");
      // Provided globally by the Helcim script loaded above.
      (window as unknown as { appendHelcimPayIframe: (token: string) => void }).appendHelcimPayIframe(checkoutToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong starting your payment. Try again.");
      setStep("amount");
    }
  }

  if (step === "closed") {
    return (
      <button type="button" onClick={open} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
        Make Payment
      </button>
    );
  }

  // Helcim's own iframe (appended to the page by appendHelcimPayIframe)
  // renders its own full-screen overlay — ours must get out of the way
  // while it's up, rather than stacking a second overlay on top of it.
  if (step === "modal") return null;

  const amountCentsEntered = Math.round((Number(amount) || 0) * 100);
  const showReserveNotice = mode === "payment" && amountCentsEntered > 0 && amountCentsEntered < breakdown.totalDueCents;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-5 shadow-lg">
        {(step === "amount" || step === "submitting") && (
          <>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Make a Payment</h2>

            <div className="mb-4 flex rounded-md bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => switchMode("payment")}
                disabled={step === "submitting"}
                className={`flex-1 rounded px-2 py-1.5 text-sm font-medium ${mode === "payment" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
              >
                Regular Payment
              </button>
              <button
                type="button"
                onClick={() => switchMode("paydown")}
                disabled={step === "submitting" || !principalPaydownEligibility.eligible}
                className={`flex-1 rounded px-2 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                  mode === "paydown" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                Principal Paydown
              </button>
            </div>

            {mode === "payment" ? (
              <div className="mb-4 space-y-1 rounded-md bg-slate-50 p-3 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Monthly Payment</span>
                  <span>{formatCents(breakdown.paymentAmountCents)}</span>
                </div>
                {breakdown.escrowPortionCents > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Escrow</span>
                    <span>{formatCents(breakdown.escrowPortionCents)}</span>
                  </div>
                )}
                {breakdown.lateFeeCents > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Late Fee</span>
                    <span>{formatCents(breakdown.lateFeeCents)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-900">
                  <span>Total Due</span>
                  <span>{formatCents(breakdown.totalDueCents)}</span>
                </div>
                {breakdown.unpaidChargesCents > 0 && (
                  <p className="pt-1 text-xs text-slate-500">
                    You also have {formatCents(breakdown.unpaidChargesCents)} in outstanding charges — a payment covering the
                    Total Due above with room to spare will go toward these next.
                  </p>
                )}
              </div>
            ) : (
              <div className="mb-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                {principalPaydownEligibility.eligible ? (
                  <p>
                    Current balance: <span className="font-medium text-slate-900">{formatCents(currentBalanceCents)}</span>. This
                    is an extra payment applied entirely to your principal — it doesn't replace your next regular payment.
                  </p>
                ) : (
                  <p className="text-amber-700">{principalPaydownEligibility.reason}</p>
                )}
              </div>
            )}

            <label className="mb-1 block text-xs text-slate-500" htmlFor="paymentAmount">
              Amount
            </label>
            <input
              id="paymentAmount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="mb-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              disabled={step === "submitting" || (mode === "paydown" && !principalPaydownEligibility.eligible)}
            />
            <p className="mb-2 text-xs text-slate-400">Card payments include a processing fee added at checkout. ACH has no fee.</p>

            {showReserveNotice && (
              <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                This is less than your total amount due ({formatCents(breakdown.totalDueCents)}) and will be held in reserve
                until a full payment is received.
              </p>
            )}

            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={step === "submitting"}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleContinue}
                disabled={step === "submitting" || (mode === "paydown" && !principalPaydownEligibility.eligible)}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {step === "submitting" ? "Starting…" : "Continue"}
              </button>
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <p className="mb-4 text-sm text-slate-700">{resultMessage}</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={close}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
