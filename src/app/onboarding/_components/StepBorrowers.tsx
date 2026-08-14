"use client";

import { useState } from "react";
import { labelClass, fieldClass, inputClass } from "./fieldClass";
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
          <label className={labelClass} htmlFor={`${prefix}EmailFormat`}>
            Email Format
          </label>
          <select id={`${prefix}EmailFormat`} name={`${prefix}EmailFormat`} defaultValue="HTML" className={inputClass}>
            <option value="HTML">HTML</option>
            <option value="TEXT">Text</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className={labelClass} htmlFor={`${prefix}PhoneHome`}>
            Home Phone
          </label>
          <input id={`${prefix}PhoneHome`} name={`${prefix}PhoneHome`} type="text" defaultValue={phone ?? ""} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${prefix}PhoneWork`}>
            Work Phone
          </label>
          <input id={`${prefix}PhoneWork`} name={`${prefix}PhoneWork`} type="text" className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${prefix}PhoneMobile`}>
            Mobile Phone
          </label>
          <input id={`${prefix}PhoneMobile`} name={`${prefix}PhoneMobile`} type="text" className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${prefix}PhoneFax`}>
            Fax
          </label>
          <input id={`${prefix}PhoneFax`} name={`${prefix}PhoneFax`} type="text" className={inputClass} />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Mailing Address</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelClass} htmlFor={`${prefix}MailingAddressLine1`}>
              Address Line 1
            </label>
            <input id={`${prefix}MailingAddressLine1`} name={`${prefix}MailingAddressLine1`} type="text" className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className={labelClass} htmlFor={`${prefix}MailingAddressLine2`}>
              Address Line 2
            </label>
            <input id={`${prefix}MailingAddressLine2`} name={`${prefix}MailingAddressLine2`} type="text" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor={`${prefix}MailingCity`}>
              City
            </label>
            <input id={`${prefix}MailingCity`} name={`${prefix}MailingCity`} type="text" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass} htmlFor={`${prefix}MailingState`}>
                State
              </label>
              <input id={`${prefix}MailingState`} name={`${prefix}MailingState`} type="text" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor={`${prefix}MailingZip`}>
                Zip
              </label>
              <input id={`${prefix}MailingZip`} name={`${prefix}MailingZip`} type="text" className={inputClass} />
            </div>
          </div>
          <div className="col-span-2">
            <label className={labelClass} htmlFor={`${prefix}MailingCountry`}>
              Country
            </label>
            <input id={`${prefix}MailingCountry`} name={`${prefix}MailingCountry`} type="text" defaultValue="United States" className={inputClass} />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Tax &amp; Notices</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor={`${prefix}TaxId`}>
              TIN
            </label>
            <input id={`${prefix}TaxId`} name={`${prefix}TaxId`} type="text" placeholder="•••••••••" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor={`${prefix}TinType`}>
              TIN Type
            </label>
            <select id={`${prefix}TinType`} name={`${prefix}TinType`} defaultValue="SSN" className={inputClass}>
              <option value="SSN">SSN</option>
              <option value="EIN">EIN</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor={`${prefix}LegalStructure`}>
              Legal Structure
            </label>
            <select id={`${prefix}LegalStructure`} name={`${prefix}LegalStructure`} defaultValue="" className={inputClass}>
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
            <label className={labelClass} htmlFor={`${prefix}DateOfBirth`}>
              Date of Birth
            </label>
            <input id={`${prefix}DateOfBirth`} name={`${prefix}DateOfBirth`} type="date" className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className={labelClass} htmlFor={`${prefix}AlternateTaxInfo`}>
              Alternate Tax Info
            </label>
            <input id={`${prefix}AlternateTaxInfo`} name={`${prefix}AlternateTaxInfo`} type="text" className={inputClass} />
          </div>
        </div>

        <div className="mt-3">
          <p className="mb-1 text-xs text-slate-500">Delivery Options</p>
          <div className="flex gap-4 text-sm text-slate-700">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name={`${prefix}DeliveryByPrint`} value="1" />
              Print
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name={`${prefix}DeliveryByEmail`} value="1" />
              Email
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name={`${prefix}DeliveryBySms`} value="1" />
              SMS
            </label>
          </div>
        </div>

        <div className="mt-3">
          <p className="mb-1 text-xs text-slate-500">Notices &amp; Forms</p>
          <div className="grid grid-cols-2 gap-1 text-sm text-slate-700">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name={`${prefix}SendTaxReporting`} value="1" />
              Tax Reporting
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name={`${prefix}SendLateNotices`} value="1" />
              Send Late Notices
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name={`${prefix}SendPaymentReceipts`} value="1" />
              Send Payment Receipts
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name={`${prefix}SendPaymentStatements`} value="1" />
              Send Payment Statements
            </label>
          </div>
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
