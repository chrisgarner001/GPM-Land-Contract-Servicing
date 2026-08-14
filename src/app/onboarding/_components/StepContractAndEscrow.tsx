"use client";

import { useState } from "react";
import { labelClass, fieldClass, inputClass } from "./fieldClass";
import type { LandContractInitialValues } from "./NewContractWizard";
import { formatCents } from "@/lib/format";

const sectionHeadClass = "mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400";

function dollarsToCentsLocal(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export default function StepContractAndEscrow({
  suggestedContractNumber,
  initial,
  highlightMissing,
}: {
  suggestedContractNumber: string;
  initial?: LandContractInitialValues;
  highlightMissing?: boolean;
}) {
  const [lateFeeType, setLateFeeType] = useState<"FLAT" | "PERCENT_OF_PI" | "PERCENT_OF_TOTAL_PAYMENT">(
    initial?.lateFeeType ?? "FLAT"
  );
  const [hasBalloon, setHasBalloon] = useState(Boolean(initial?.hasBalloon));
  const [escrowRequired, setEscrowRequired] = useState(Boolean(initial?.escrowRequired));

  const [paymentAmount, setPaymentAmount] = useState(initial?.paymentAmount ?? "");
  const [escrowPayment, setEscrowPayment] = useState(initial?.escrowPayment ?? "");

  // Straight from the land contract, not derived from the impound balance or
  // any projection — if the LC says $X for escrow, $X is the payment, full
  // stop. The starting balance/projected tax/insurance below are historical
  // record-keeping only and don't feed this number.
  const totalMonthlyPaymentCents = dollarsToCentsLocal(paymentAmount) + (escrowRequired ? dollarsToCentsLocal(escrowPayment) : 0);

  return (
    <div className="space-y-6">
      <div>
        <h3 className={sectionHeadClass}>Contract</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="contractNumber">
              Contract Number
            </label>
            <input
              id="contractNumber"
              name="contractNumber"
              type="text"
              required
              defaultValue={initial?.contractNumber || suggestedContractNumber}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="loanType">
              Loan Type
            </label>
            <select id="loanType" name="loanType" defaultValue={initial?.loanType ?? "LAND_CONTRACT"} className={inputClass}>
              <option value="LAND_CONTRACT">Land Contract</option>
              <option value="FIRST_LIEN">1st Lien</option>
              <option value="SECOND_LIEN">2nd Lien</option>
              <option value="UNSECURED">Unsecured</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <h3 className={sectionHeadClass}>Purchase &amp; Loan Terms</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass} htmlFor="purchasePrice">
              Purchase Price ($)
            </label>
            <input
              id="purchasePrice"
              name="purchasePrice"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={initial?.purchasePrice ?? ""}
              className={fieldClass(initial?.purchasePrice, highlightMissing)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="downPayment">
              Down Payment ($)
            </label>
            <input
              id="downPayment"
              name="downPayment"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={initial?.downPayment ?? ""}
              className={fieldClass(initial?.downPayment, highlightMissing)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="originalPrincipal">
              Original Principal ($)
            </label>
            <input
              id="originalPrincipal"
              name="originalPrincipal"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={initial?.originalPrincipal ?? ""}
              className={fieldClass(initial?.originalPrincipal, highlightMissing)}
            />
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-400">Original Principal is typically Purchase Price − Down Payment.</p>

        <div className="mt-3 max-w-xs">
          <label className={labelClass} htmlFor="currentPrincipalBalance">
            Current Principal Balance ($)
          </label>
          <input
            id="currentPrincipalBalance"
            name="currentPrincipalBalance"
            type="number"
            step="0.01"
            min="0"
            placeholder="Same as Original Principal"
            defaultValue={initial?.currentPrincipalBalance ?? ""}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-400">
            Leave blank for a brand-new contract. If we&apos;re taking over servicing of a land contract already in
            progress, enter the actual balance as of today — it won&apos;t be assumed equal to Original Principal.
          </p>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass} htmlFor="interestRateAnnual">
              Interest Rate (annual %)
            </label>
            <input
              id="interestRateAnnual"
              name="interestRateAnnual"
              type="number"
              step="0.0001"
              min="0"
              required
              defaultValue={initial?.interestRateAnnual ?? ""}
              className={fieldClass(initial?.interestRateAnnual, highlightMissing)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="interestMethod">
              Interest Method
            </label>
            <select id="interestMethod" name="interestMethod" defaultValue={initial?.interestMethod ?? "SIMPLE_30_360"} className={inputClass}>
              <option value="SIMPLE_30_360">30/360</option>
              <option value="SIMPLE_ACTUAL_365">Actual/365</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="amortizationTermMonths">
              Amortization Term (months)
            </label>
            <input
              id="amortizationTermMonths"
              name="amortizationTermMonths"
              type="number"
              step="1"
              min="1"
              required
              defaultValue={initial?.amortizationTermMonths ?? ""}
              className={fieldClass(initial?.amortizationTermMonths, highlightMissing)}
            />
          </div>
        </div>

        <div className="mt-3">
          <label className={labelClass} htmlFor="lienPriority">
            Lien Priority
          </label>
          <select id="lienPriority" name="lienPriority" defaultValue={initial?.lienPriority ?? "1ST"} className={`${inputClass} max-w-xs`}>
            <option value="1ST">1st</option>
            <option value="2ND">2nd</option>
            <option value="3RD">3rd</option>
            <option value="4TH">4th</option>
            <option value="5TH">5th</option>
            <option value="6TH">6th</option>
            <option value="7TH">7th</option>
            <option value="8TH">8th</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      <div>
        <h3 className={sectionHeadClass}>Payment Schedule</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="paymentAmount">
              Payment Amount — P&amp;I ($)
            </label>
            <input
              id="paymentAmount"
              name="paymentAmount"
              type="number"
              step="0.01"
              min="0"
              required
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className={fieldClass(initial?.paymentAmount, highlightMissing)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="paymentFrequency">
              Payment Frequency
            </label>
            <select id="paymentFrequency" name="paymentFrequency" defaultValue={initial?.paymentFrequency ?? "MONTHLY"} className={inputClass}>
              <option value="MONTHLY">Monthly</option>
              <option value="SEMI_MONTHLY">Semi-Monthly</option>
              <option value="BIWEEKLY">Biweekly</option>
            </select>
          </div>
        </div>

        {escrowRequired && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="escrowPayment">
                Escrow Payment ($)
              </label>
              <input
                id="escrowPayment"
                name="escrowPayment"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="As stated on the land contract"
                value={escrowPayment}
                onChange={(e) => setEscrowPayment(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-slate-400">
                Straight from the land contract — not calculated from the impound balance below.
              </p>
            </div>
            <div className="rounded-md bg-slate-50 p-3 text-sm">
              <p className="text-xs text-slate-500">Total Monthly Payment (P&amp;I + Escrow)</p>
              <p className="font-medium tabular-nums text-slate-900">{formatCents(totalMonthlyPaymentCents)}</p>
            </div>
          </div>
        )}

        <div className="mt-3 grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass} htmlFor="originationDate">
              Origination Date
            </label>
            <input
              id="originationDate"
              name="originationDate"
              type="date"
              required
              defaultValue={initial?.originationDate ?? ""}
              className={fieldClass(initial?.originationDate, highlightMissing)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="firstPaymentDate">
              First Payment Date
            </label>
            <input
              id="firstPaymentDate"
              name="firstPaymentDate"
              type="date"
              required
              defaultValue={initial?.firstPaymentDate ?? ""}
              className={fieldClass(initial?.firstPaymentDate, highlightMissing)}
            />
            <p className="mt-1 text-xs text-slate-400">The LC&apos;s own original first payment date, for the record.</p>
          </div>
          <div>
            <label className={labelClass} htmlFor="maturityDate">
              Maturity Date
            </label>
            <input
              id="maturityDate"
              name="maturityDate"
              type="date"
              defaultValue={initial?.maturityDate ?? ""}
              className={fieldClass(initial?.maturityDate, highlightMissing)}
            />
          </div>
        </div>

        <div className="mt-3 max-w-xs">
          <label className={labelClass} htmlFor="nextPaymentDate">
            Next Payment Date (collected by us)
          </label>
          <input
            id="nextPaymentDate"
            name="nextPaymentDate"
            type="date"
            placeholder="Same as First Payment Date"
            defaultValue={initial?.nextPaymentDate ?? ""}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-400">
            Leave blank if this matches First Payment Date. If we&apos;re taking over servicing mid-term, enter the
            next payment date we&apos;ll actually be collecting.
          </p>
        </div>
      </div>

      <div>
        <h3 className={sectionHeadClass}>Late Fees &amp; Balloon</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass} htmlFor="lateFeeType">
              Late Fee Type
            </label>
            <select
              id="lateFeeType"
              name="lateFeeType"
              value={lateFeeType}
              onChange={(e) => setLateFeeType(e.target.value as typeof lateFeeType)}
              className={inputClass}
            >
              <option value="FLAT">Flat</option>
              <option value="PERCENT_OF_PI">% of Principal &amp; Interest</option>
              <option value="PERCENT_OF_TOTAL_PAYMENT">% of Total Payment</option>
            </select>
          </div>
          {lateFeeType === "FLAT" ? (
            <div>
              <label className={labelClass} htmlFor="lateFeeAmount">
                Late Fee Amount ($)
              </label>
              <input
                id="lateFeeAmount"
                name="lateFeeAmount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={initial?.lateFeeAmount ?? ""}
                className={inputClass}
              />
            </div>
          ) : (
            <div>
              <label className={labelClass} htmlFor="lateFeePercent">
                Late Fee Percent (%)
              </label>
              <input
                id="lateFeePercent"
                name="lateFeePercent"
                type="number"
                step="0.01"
                min="0"
                defaultValue={initial?.lateFeePercent ?? ""}
                className={inputClass}
              />
            </div>
          )}
          <div>
            <label className={labelClass} htmlFor="lateFeeGraceDays">
              Grace Days
            </label>
            <input
              id="lateFeeGraceDays"
              name="lateFeeGraceDays"
              type="number"
              step="1"
              min="0"
              defaultValue={initial?.lateFeeGraceDays ?? ""}
              className={inputClass}
            />
          </div>
        </div>

        <div className="mt-3 border-t border-slate-100 pt-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" name="hasBalloon" value="1" checked={hasBalloon} onChange={(e) => setHasBalloon(e.target.checked)} />
            Has Balloon Payment
          </label>
          {hasBalloon && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="balloonAmount">
                  Balloon Amount ($)
                </label>
                <input
                  id="balloonAmount"
                  name="balloonAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  required={hasBalloon}
                  defaultValue={initial?.balloonAmount ?? ""}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="balloonDueDate">
                  Balloon Due Date
                </label>
                <input
                  id="balloonDueDate"
                  name="balloonDueDate"
                  type="date"
                  required={hasBalloon}
                  defaultValue={initial?.balloonDueDate ?? ""}
                  className={inputClass}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <h3 className={sectionHeadClass}>Escrow Setup</h3>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            name="escrowRequired"
            value="1"
            checked={escrowRequired}
            onChange={(e) => setEscrowRequired(e.target.checked)}
          />
          Escrow Required
        </label>

        {escrowRequired && (
          <div className="mt-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass} htmlFor="projectedAnnualTax">
                  Projected Annual Tax ($)
                </label>
                <input
                  id="projectedAnnualTax"
                  name="projectedAnnualTax"
                  type="number"
                  step="0.01"
                  min="0"
                  required={escrowRequired}
                  defaultValue={initial?.projectedAnnualTax ?? ""}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="projectedAnnualInsurance">
                  Projected Annual Insurance ($)
                </label>
                <input
                  id="projectedAnnualInsurance"
                  name="projectedAnnualInsurance"
                  type="number"
                  step="0.01"
                  min="0"
                  required={escrowRequired}
                  defaultValue={initial?.projectedAnnualInsurance ?? ""}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="startingEscrowBalance">
                  Starting Escrow/Impound Balance ($)
                </label>
                <input
                  id="startingEscrowBalance"
                  name="startingEscrowBalance"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={initial?.startingEscrowBalance ?? "0"}
                  className={inputClass}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Record-keeping only — the balance already sitting in the impound account as of today. It has no effect
              on the Escrow Payment amount above; that comes straight from the land contract.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
