"use client";

import { useState } from "react";
import { labelClass, inputClass } from "./fieldClass";

export default function StepLender({ existingLenders }: { existingLenders: { id: string; displayName: string }[] }) {
  const [lenderMode, setLenderMode] = useState<"existing" | "new">(existingLenders.length > 0 ? "existing" : "new");
  const [newPartyType, setNewPartyType] = useState<"BUSINESS" | "INDIVIDUAL">("BUSINESS");

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Lender</h3>

        <div className="mb-3 flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="lenderMode"
              value="existing"
              checked={lenderMode === "existing"}
              onChange={() => setLenderMode("existing")}
              disabled={existingLenders.length === 0}
            />
            Existing Lender
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="lenderMode" value="new" checked={lenderMode === "new"} onChange={() => setLenderMode("new")} />
            New Lender
          </label>
        </div>

        {lenderMode === "existing" ? (
          <div>
            <label className={labelClass} htmlFor="lenderExistingPartyId">
              Lender
            </label>
            <select id="lenderExistingPartyId" name="lenderExistingPartyId" required className={inputClass} defaultValue="">
              <option value="" disabled>
                Select a lender…
              </option>
              {existingLenders.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.displayName}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Type</label>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="lenderNewPartyType"
                    value="BUSINESS"
                    checked={newPartyType === "BUSINESS"}
                    onChange={() => setNewPartyType("BUSINESS")}
                  />
                  Business
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="lenderNewPartyType"
                    value="INDIVIDUAL"
                    checked={newPartyType === "INDIVIDUAL"}
                    onChange={() => setNewPartyType("INDIVIDUAL")}
                  />
                  Individual
                </label>
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="lenderDisplayName">
                {newPartyType === "INDIVIDUAL" ? "Full Name" : "Company Name"}
              </label>
              <input id="lenderDisplayName" name="lenderDisplayName" type="text" required className={inputClass} />
            </div>

            {newPartyType === "INDIVIDUAL" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} htmlFor="lenderFirstName">
                    First Name
                  </label>
                  <input id="lenderFirstName" name="lenderFirstName" type="text" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="lenderLastName">
                    Last Name
                  </label>
                  <input id="lenderLastName" name="lenderLastName" type="text" className={inputClass} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="lenderEmail">
                  Email
                </label>
                <input id="lenderEmail" name="lenderEmail" type="email" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="lenderPhone">
                  Phone
                </label>
                <input id="lenderPhone" name="lenderPhone" type="text" className={inputClass} />
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="lenderMailingAddressLine1">
                Mailing Address
              </label>
              <input id="lenderMailingAddressLine1" name="lenderMailingAddressLine1" type="text" className={inputClass} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass} htmlFor="lenderMailingCity">
                  City
                </label>
                <input id="lenderMailingCity" name="lenderMailingCity" type="text" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="lenderMailingState">
                  State
                </label>
                <input id="lenderMailingState" name="lenderMailingState" type="text" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="lenderMailingZip">
                  Zip
                </label>
                <input id="lenderMailingZip" name="lenderMailingZip" type="text" className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="lenderPortalPin">
                  Portal PIN
                </label>
                <input id="lenderPortalPin" name="lenderPortalPin" type="text" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="lenderPreferredPaymentMethod">
                  Preferred Payment Method
                </label>
                <select id="lenderPreferredPaymentMethod" name="lenderPreferredPaymentMethod" defaultValue="" className={inputClass}>
                  <option value="">Check (default)</option>
                  <option value="CHECK">Check</option>
                  <option value="ACH">ACH</option>
                </select>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">TIN &amp; ACH Banking</h4>

              <div className="mb-3">
                <label className={labelClass} htmlFor="lenderTaxId">
                  EIN / TIN (or SSN)
                </label>
                <input id="lenderTaxId" name="lenderTaxId" type="text" className={inputClass} />
              </div>

              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} htmlFor="lenderAchBankName">
                    Bank Name
                  </label>
                  <input id="lenderAchBankName" name="lenderAchBankName" type="text" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="lenderAchRoutingNumber">
                    Routing Number
                  </label>
                  <input id="lenderAchRoutingNumber" name="lenderAchRoutingNumber" type="text" className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="lenderAchAccountNumber">
                  Account Number
                </label>
                <input id="lenderAchAccountNumber" name="lenderAchAccountNumber" type="text" className={inputClass} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 pt-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Funding</h3>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className={labelClass} htmlFor="lenderFundedAmount">
              Funded Amount ($)
            </label>
            <input id="lenderFundedAmount" name="lenderFundedAmount" type="number" step="0.01" min="0.01" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="lenderOwnershipPercent">
              Ownership (%)
            </label>
            <input
              id="lenderOwnershipPercent"
              name="lenderOwnershipPercent"
              type="number"
              step="0.01"
              min="0.01"
              max="100"
              required
              defaultValue="100"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="lenderInterestRate">
              Interest Rate (%)
            </label>
            <input
              id="lenderInterestRate"
              name="lenderInterestRate"
              type="number"
              step="0.001"
              min="0"
              max="100"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="lenderFundingDate">
              Funding Date
            </label>
            <input id="lenderFundingDate" name="lenderFundingDate" type="date" required defaultValue={today} className={inputClass} />
          </div>
        </div>

        <div className="mt-3">
          <label className={labelClass} htmlFor="lenderServicingFee">
            Servicing Fee ($)
          </label>
          <input
            id="lenderServicingFee"
            name="lenderServicingFee"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            className={`${inputClass} max-w-[10rem]`}
          />
          <p className="mt-1 text-xs text-slate-400">
            Flat dollar amount deducted from this lender&apos;s share of each payment. Leave blank for none.
          </p>
        </div>
      </div>
    </div>
  );
}
