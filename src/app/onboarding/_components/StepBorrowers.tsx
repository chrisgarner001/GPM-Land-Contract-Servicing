"use client";

import { useState } from "react";
import { labelClass, fieldClass } from "./fieldClass";
import type { LandContractInitialValues } from "./NewContractWizard";

function PersonFields({
  prefix,
  required,
  initial,
  highlightMissing,
}: {
  prefix: "borrower" | "coBorrower";
  required: boolean;
  initial?: LandContractInitialValues;
  highlightMissing?: boolean;
}) {
  const defaultPartyType = (prefix === "borrower" ? initial?.borrowerPartyType : initial?.coBorrowerPartyType) ?? "INDIVIDUAL";
  const [partyType, setPartyType] = useState<"INDIVIDUAL" | "BUSINESS">(defaultPartyType);

  const firstName = prefix === "borrower" ? initial?.borrowerFirstName : initial?.coBorrowerFirstName;
  const middleInitial = prefix === "borrower" ? initial?.borrowerMiddleInitial : initial?.coBorrowerMiddleInitial;
  const lastName = prefix === "borrower" ? initial?.borrowerLastName : initial?.coBorrowerLastName;
  const salutation = prefix === "borrower" ? initial?.borrowerSalutation : initial?.coBorrowerSalutation;
  const companyName = prefix === "borrower" ? initial?.borrowerCompanyName : initial?.coBorrowerCompanyName;
  const email = prefix === "borrower" ? initial?.borrowerEmail : initial?.coBorrowerEmail;
  const phone = prefix === "borrower" ? initial?.borrowerPhone : initial?.coBorrowerPhone;

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Type</label>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name={`${prefix}PartyType`}
              value="INDIVIDUAL"
              checked={partyType === "INDIVIDUAL"}
              onChange={() => setPartyType("INDIVIDUAL")}
            />
            Individual
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name={`${prefix}PartyType`}
              value="BUSINESS"
              checked={partyType === "BUSINESS"}
              onChange={() => setPartyType("BUSINESS")}
            />
            Business
          </label>
        </div>
      </div>

      {partyType === "INDIVIDUAL" ? (
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className={labelClass} htmlFor={`${prefix}Salutation`}>
              Salutation
            </label>
            <input
              id={`${prefix}Salutation`}
              name={`${prefix}Salutation`}
              type="text"
              placeholder="Mr., Mrs...."
              defaultValue={salutation ?? ""}
              className={fieldClass(salutation, highlightMissing)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`${prefix}FirstName`}>
              First Name
            </label>
            <input
              id={`${prefix}FirstName`}
              name={`${prefix}FirstName`}
              type="text"
              required={required}
              defaultValue={firstName ?? ""}
              className={fieldClass(firstName, highlightMissing)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`${prefix}MiddleInitial`}>
              M.I.
            </label>
            <input
              id={`${prefix}MiddleInitial`}
              name={`${prefix}MiddleInitial`}
              type="text"
              maxLength={1}
              defaultValue={middleInitial ?? ""}
              className={fieldClass(middleInitial, highlightMissing)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`${prefix}LastName`}>
              Last Name
            </label>
            <input
              id={`${prefix}LastName`}
              name={`${prefix}LastName`}
              type="text"
              required={required}
              defaultValue={lastName ?? ""}
              className={fieldClass(lastName, highlightMissing)}
            />
          </div>
        </div>
      ) : (
        <div>
          <label className={labelClass} htmlFor={`${prefix}CompanyName`}>
            Company Name
          </label>
          <input
            id={`${prefix}CompanyName`}
            name={`${prefix}CompanyName`}
            type="text"
            required={required}
            defaultValue={companyName ?? ""}
            className={fieldClass(companyName, highlightMissing)}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor={`${prefix}Email`}>
            Email
          </label>
          <input
            id={`${prefix}Email`}
            name={`${prefix}Email`}
            type="email"
            defaultValue={email ?? ""}
            className={fieldClass(email, highlightMissing)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${prefix}Phone`}>
            Phone
          </label>
          <input
            id={`${prefix}Phone`}
            name={`${prefix}Phone`}
            type="text"
            defaultValue={phone ?? ""}
            className={fieldClass(phone, highlightMissing)}
          />
        </div>
      </div>
    </div>
  );
}

export default function StepBorrowers({
  initial,
  highlightMissing,
}: {
  initial?: LandContractInitialValues;
  highlightMissing?: boolean;
}) {
  const [hasCoBorrower, setHasCoBorrower] = useState(Boolean(initial?.hasCoBorrower));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Borrower</h3>
        <PersonFields prefix="borrower" required initial={initial} highlightMissing={highlightMissing} />
      </div>

      <div className="border-t border-slate-100 pt-4">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            name="hasCoBorrower"
            value="1"
            checked={hasCoBorrower}
            onChange={(e) => setHasCoBorrower(e.target.checked)}
          />
          Add Co-Borrower
        </label>
      </div>

      {hasCoBorrower && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Co-Borrower</h3>
          <PersonFields prefix="coBorrower" required={hasCoBorrower} initial={initial} highlightMissing={highlightMissing} />
        </div>
      )}
    </div>
  );
}
