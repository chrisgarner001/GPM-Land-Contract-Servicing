"use client";

import { useActionState, useMemo, useState } from "react";
import type { Answers } from "@/domain/landContractPackage/answers";
import { calculateEscrowReserveAmount, calculatePrepaidInterest, monthlyEscrowAmount } from "@/domain/landContractPackage/closingStatement";
import { computeMonthlyPaymentCents } from "@/domain/amortization/generateSchedule";
import { submitPackageAction, assessorLookupAction, type SubmitPackageState } from "../actions";

const inputClass = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none";
const labelClass = "mb-1 block text-xs font-medium text-slate-600";

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  placeholder,
  required,
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className={labelClass} htmlFor={name}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        step={type === "number" ? "0.01" : undefined}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      {children}
    </div>
  );
}

// A value derived entirely from other fields — always shown read-only and
// submitted via a paired hidden input, never hand-typed.
function ComputedField({ name, label, value, hint }: { name: string; label: string; value: string; hint?: string }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input value={value} disabled className={`${inputClass} bg-slate-50 text-slate-500`} />
      <input type="hidden" name={name} value={value} />
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

// Pre-fills at percent% of basis (e.g. a 3% commission) but stays fully
// editable — once staff types their own number it stops following the
// default. An existing saved value (editing a draft) is treated as already
// touched, so reloading never silently overwrites a figure someone chose.
function SmartDefaultField({
  name,
  label,
  basis,
  percent,
  initialValue,
}: {
  name: string;
  label: string;
  basis: number;
  percent: number;
  initialValue: string;
}) {
  const [touched, setTouched] = useState(Boolean(initialValue));
  const [manualValue, setManualValue] = useState(initialValue);
  const computedValue = basis > 0 ? (basis * (percent / 100)).toFixed(2) : "";
  const value = touched ? manualValue : computedValue;
  return (
    <div>
      <label className={labelClass} htmlFor={name}>
        {label} ({percent}% default)
      </label>
      <input
        id={name}
        name={name}
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => {
          setTouched(true);
          setManualValue(e.target.value);
        }}
        className={inputClass}
      />
    </div>
  );
}

// Funds the BUYER's own new escrow/impound reserve for one recurring bill —
// never a seller proration (see calculateEscrowReserveAmount's doc comment).
// The annual bill / 12 becomes the ongoing monthly escrow payment; a lump
// sum (the accrual gap since the bill period started, plus the cushion) is
// collected at closing. Bill-period start is omitted for insurance, since
// the buyer brings a paid-current policy — only the cushion applies there.
function EscrowReserveFields({
  prefix,
  label,
  annualAmount,
  onAnnualAmountChange,
  periodStart,
  onPeriodStartChange,
  firstPaymentDate,
  cushionMonths,
}: {
  prefix: string;
  label: string;
  annualAmount: string;
  onAnnualAmountChange: (v: string) => void;
  periodStart?: string;
  onPeriodStartChange?: (v: string) => void;
  firstPaymentDate: string;
  cushionMonths: number;
}) {
  const reserveDueAtClosing = useMemo(() => {
    const annual = Number(annualAmount) || 0;
    if (!annual) return null;
    return calculateEscrowReserveAmount({
      annualAmount: annual,
      billPeriodStart: periodStart || undefined,
      firstPaymentDate: firstPaymentDate || new Date().toISOString().slice(0, 10),
      cushionMonths,
    });
  }, [annualAmount, periodStart, firstPaymentDate, cushionMonths]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:col-span-3 sm:grid-cols-6 sm:items-end sm:border-t sm:border-slate-100 sm:pt-3">
      <div className="sm:col-span-2">
        <label className={labelClass} htmlFor={`${prefix}_annual_amount`}>
          {label} — Annual Bill ($)
        </label>
        <input
          id={`${prefix}_annual_amount`}
          name={`${prefix}_annual_amount`}
          type="number"
          step="0.01"
          value={annualAmount}
          onChange={(e) => onAnnualAmountChange(e.target.value)}
          className={inputClass}
        />
      </div>
      {onPeriodStartChange ? (
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor={`${prefix}_period_start`}>
            Current Bill Period Starts
          </label>
          <input
            id={`${prefix}_period_start`}
            name={`${prefix}_period_start`}
            type="date"
            value={periodStart ?? ""}
            onChange={(e) => onPeriodStartChange(e.target.value)}
            className={inputClass}
          />
        </div>
      ) : (
        <div className="sm:col-span-2" />
      )}
      <div className="sm:col-span-2 text-xs text-slate-500">
        {reserveDueAtClosing !== null ? (
          <>
            Reserve due at closing: <span className="font-medium text-slate-700">${reserveDueAtClosing.toFixed(2)}</span>
            <br />
            Monthly escrow: ${monthlyEscrowAmount(Number(annualAmount) || 0).toFixed(2)}
          </>
        ) : (
          "Enter the annual bill to see the reserve due at closing."
        )}
      </div>
    </div>
  );
}

export default function PackageForm({ packageId, initialAnswers }: { packageId: string; initialAnswers: Answers }) {
  const action = submitPackageAction.bind(null, packageId);
  const [state, formAction, pending] = useActionState<SubmitPackageState | undefined, FormData>(action, undefined);

  const [propertyStreet, setPropertyStreet] = useState(initialAnswers.property_street ?? "");
  const [propertyCity, setPropertyCity] = useState(initialAnswers.property_city ?? "");
  const [propertyState, setPropertyState] = useState(initialAnswers.property_state ?? "MI");
  const [propertyZip, setPropertyZip] = useState(initialAnswers.property_zip ?? "");
  const [propertyCounty, setPropertyCounty] = useState(initialAnswers.property_county ?? "");
  const [legalDescription, setLegalDescription] = useState(initialAnswers.legal_description ?? "");
  const [parcelId, setParcelId] = useState(initialAnswers.parcel_id ?? "");
  const [occupancyType, setOccupancyType] = useState(initialAnswers.occupancy_type ?? "PRIMARY");
  const [hasCoBuyer, setHasCoBuyer] = useState(Boolean(initialAnswers.co_buyer_name));
  const [municipalityTypeDisplay, setMunicipalityTypeDisplay] = useState(initialAnswers.municipality_type ?? "City");

  const [lookupPending, setLookupPending] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupOwner, setLookupOwner] = useState<string | null>(null);
  const [firstPaymentDate, setFirstPaymentDate] = useState(initialAnswers.first_payment_date ?? "");
  const [closingDate, setClosingDate] = useState(initialAnswers.closing_date ?? "");
  const [escrowCushionMonths, setEscrowCushionMonths] = useState(initialAnswers.escrow_cushion_months || "2");
  const [propertyTaxAnnualAmount, setPropertyTaxAnnualAmount] = useState(initialAnswers.property_tax_annual_amount ?? "");
  const [propertyTaxPeriodStart, setPropertyTaxPeriodStart] = useState(initialAnswers.property_tax_period_start ?? "");
  const [insuranceAnnualAmount, setInsuranceAnnualAmount] = useState(initialAnswers.insurance_annual_amount ?? "");
  const [cityTaxAnnualAmount, setCityTaxAnnualAmount] = useState(initialAnswers.city_property_tax_annual_amount ?? "");
  const [cityTaxPeriodStart, setCityTaxPeriodStart] = useState(initialAnswers.city_property_tax_period_start ?? "");
  const [purchasePrice, setPurchasePrice] = useState(initialAnswers.purchase_price ?? "");
  const [downPayment, setDownPayment] = useState(initialAnswers.down_payment ?? "");
  const [interestRate, setInterestRate] = useState(initialAnswers.interest_rate ?? "");
  const [amortizationMonths, setAmortizationMonths] = useState(initialAnswers.amortization_months ?? "360");

  const cushionMonthsNumber = Number(escrowCushionMonths) || 2;
  const computedMonthlyEscrow =
    monthlyEscrowAmount(Number(propertyTaxAnnualAmount) || 0) +
    monthlyEscrowAmount(Number(insuranceAnnualAmount) || 0) +
    monthlyEscrowAmount(Number(cityTaxAnnualAmount) || 0);

  const purchasePriceNumber = Number(purchasePrice) || 0;
  const interestRateNumber = Number(interestRate) || 0;
  const amortizationMonthsNumber = Number(amortizationMonths) || 0;
  const computedOriginalPrincipal = Math.max(0, purchasePriceNumber - (Number(downPayment) || 0));
  const computedMonthlyPI =
    amortizationMonthsNumber > 0
      ? computeMonthlyPaymentCents(Math.round(computedOriginalPrincipal * 100), interestRateNumber, amortizationMonthsNumber) / 100
      : 0;
  const computedPrepaidInterest = calculatePrepaidInterest({
    financedAmount: computedOriginalPrincipal,
    annualRatePercent: interestRateNumber,
    closingDate: closingDate || new Date().toISOString().slice(0, 10),
    firstPaymentDate: firstPaymentDate || new Date().toISOString().slice(0, 10),
  });

  async function handleAssessorLookup() {
    setLookupError(null);
    setLookupOwner(null);
    setLookupPending(true);
    try {
      const address = [propertyStreet, propertyCity, `${propertyState} ${propertyZip}`.trim()].filter(Boolean).join(", ");
      if (!propertyStreet.trim() || !propertyCity.trim()) {
        setLookupError("Enter at least Street Address and City first.");
        return;
      }
      const result = await assessorLookupAction(address);
      if (result.error) {
        setLookupError(result.error);
        return;
      }
      if (result.county) setPropertyCounty(result.county);
      if (result.legalDescription) setLegalDescription(result.legalDescription);
      if (result.parcelId) setParcelId(result.parcelId);
      if (result.ownerFullName) setLookupOwner(result.ownerFullName);
      if (result.annualTax && !propertyTaxAnnualAmount) setPropertyTaxAnnualAmount(result.annualTax);
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : "Lookup failed.");
    } finally {
      setLookupPending(false);
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      <Card title="Buyer">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field name="buyer_name" label="Buyer Full Name" defaultValue={initialAnswers.buyer_name} required />
          <Field name="buyer_ssn_last4" label="SSN — Last 4 Digits" defaultValue={initialAnswers.buyer_ssn_last4} placeholder="1234" />
          <div className="sm:col-span-2">
            <Field name="buyer_address" label="Current Mailing Address" defaultValue={initialAnswers.buyer_address} placeholder="Street, City, State ZIP" />
          </div>
          <Field name="buyer_phone" label="Primary Phone" defaultValue={initialAnswers.buyer_phone} />
          <Field name="buyer_secondary_phone" label="Secondary Phone" defaultValue={initialAnswers.buyer_secondary_phone} />
          <Field name="buyer_email" label="Email" defaultValue={initialAnswers.buyer_email} type="email" />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={hasCoBuyer} onChange={(e) => setHasCoBuyer(e.target.checked)} />
          Add Co-Buyer
        </label>
        {hasCoBuyer && (
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field name="co_buyer_name" label="Co-Buyer Full Name" defaultValue={initialAnswers.co_buyer_name} />
            <Field name="co_buyer_ssn_last4" label="Co-Buyer SSN — Last 4 Digits" defaultValue={initialAnswers.co_buyer_ssn_last4} />
          </div>
        )}
      </Card>

      <Card title="Seller">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field name="seller_name" label="Seller (Vendor) Entity Name" defaultValue={initialAnswers.seller_name} required />
          <Field name="seller_signatory_name" label="Seller Signatory Name" defaultValue={initialAnswers.seller_signatory_name} placeholder="e.g. Christopher L. Garner" />
          <div className="sm:col-span-2">
            <Field name="seller_address" label="Seller Mailing Address" defaultValue={initialAnswers.seller_address} placeholder="Street, City, State ZIP" />
          </div>
          <Field name="account_number" label="Land Contract Account Number" defaultValue={initialAnswers.account_number} />
        </div>
      </Card>

      <Card title="Lender / Loan Originator">
        <p className="mb-2 text-xs text-slate-400">
          Defaults from Setup &gt; Company Settings — override here only if this specific package needs something different.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field name="lender_name" label="Lender Entity Name" defaultValue={initialAnswers.lender_name} required />
          <Field name="lender_nmls_id" label="Lender NMLS ID" defaultValue={initialAnswers.lender_nmls_id} />
          <div className="sm:col-span-2">
            <Field name="lender_address" label="Lender Mailing Address" defaultValue={initialAnswers.lender_address} placeholder="Street, City, State ZIP" />
          </div>
          <Field name="lender_signatory_name" label="Lender Signatory Name" defaultValue={initialAnswers.lender_signatory_name} />
          <div />
          <Field name="loan_originator_name" label="Loan Originator Name" defaultValue={initialAnswers.loan_originator_name} />
          <Field name="loan_originator_nmls" label="Loan Originator NMLS ID" defaultValue={initialAnswers.loan_originator_nmls} />
        </div>
      </Card>

      <Card title="Document Preparer / Attorney">
        <p className="mb-2 text-xs text-slate-400">
          Defaults from Setup &gt; Company Settings. The &quot;This instrument was prepared by:&quot; block on the Land Contract and
          Note, and the attorney named in the No Legal Advice acknowledgment.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field name="preparer_firm_name" label="Firm Name" defaultValue={initialAnswers.preparer_firm_name} required />
          <Field name="preparer_attorney_name" label="Attorney Name" defaultValue={initialAnswers.preparer_attorney_name} />
          <div className="sm:col-span-2">
            <Field name="preparer_address_line1" label="Address" defaultValue={initialAnswers.preparer_address_line1} />
          </div>
          <Field name="preparer_city" label="City" defaultValue={initialAnswers.preparer_city} />
          <Field name="preparer_state" label="State" defaultValue={initialAnswers.preparer_state} />
          <Field name="preparer_zip" label="Zip" defaultValue={initialAnswers.preparer_zip} />
          <Field name="title_fee" label="Title Settlement Fee ($)" defaultValue={initialAnswers.title_fee} type="number" />
        </div>
      </Card>

      <Card title="Property">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="property_street">
              Street Address <span className="text-red-500">*</span>
            </label>
            <input id="property_street" name="property_street" value={propertyStreet} onChange={(e) => setPropertyStreet(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="property_city">
              City
            </label>
            <input id="property_city" name="property_city" value={propertyCity} onChange={(e) => setPropertyCity(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="property_zip">
              Zip
            </label>
            <input id="property_zip" name="property_zip" value={propertyZip} onChange={(e) => setPropertyZip(e.target.value)} className={inputClass} />
          </div>
          <input type="hidden" name="property_state" value={propertyState} />
          <div>
            <label className={labelClass} htmlFor="property_state_input">
              State
            </label>
            <input id="property_state_input" value={propertyState} onChange={(e) => setPropertyState(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="property_county">
              County
            </label>
            <input id="property_county" name="property_county" value={propertyCounty} onChange={(e) => setPropertyCounty(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="parcel_id">
              Parcel / Tax ID
            </label>
            <input id="parcel_id" name="parcel_id" value={parcelId} onChange={(e) => setParcelId(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Municipality Type</label>
            <div className="flex gap-1">
              {["City", "Township", "Village"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMunicipalityTypeDisplay(t)}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-sm ${
                    municipalityTypeDisplay === t ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-600"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <input type="hidden" name="municipality_type" value={municipalityTypeDisplay} />
          </div>
          <Field name="municipality_name" label="Municipality Name" defaultValue={initialAnswers.municipality_name} placeholder="e.g. City of Harper Woods" />
        </div>

        <div className="mt-3">
          <label className={labelClass} htmlFor="legal_description">
            Legal Description
          </label>
          <textarea
            id="legal_description"
            name="legal_description"
            value={legalDescription}
            onChange={(e) => setLegalDescription(e.target.value)}
            rows={3}
            className={inputClass}
          />
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleAssessorLookup}
            disabled={lookupPending}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {lookupPending ? "Looking up…" : "Look Up on AssessorSearch"}
          </button>
          {lookupError && <span className="text-sm text-red-600">{lookupError}</span>}
          {lookupOwner && (
            <span className="text-sm text-slate-600">
              Assessor shows current owner of record as <strong>{lookupOwner}</strong> — confirm this matches the Seller above.
            </span>
          )}
        </div>
      </Card>

      <Card title="Financial Terms">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="purchase_price">
              Purchase Price ($) <span className="text-red-500">*</span>
            </label>
            <input
              id="purchase_price"
              name="purchase_price"
              type="number"
              step="0.01"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="down_payment">
              Down Payment ($)
            </label>
            <input
              id="down_payment"
              name="down_payment"
              type="number"
              step="0.01"
              value={downPayment}
              onChange={(e) => setDownPayment(e.target.value)}
              className={inputClass}
            />
          </div>
          <ComputedField
            name="original_principal"
            label="Amount Financed / Principal ($)"
            value={computedOriginalPrincipal.toFixed(2)}
            hint="Purchase price − down payment."
          />
          <div>
            <label className={labelClass} htmlFor="interest_rate">
              Interest Rate (%)
            </label>
            <input
              id="interest_rate"
              name="interest_rate"
              type="number"
              step="0.01"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              className={inputClass}
            />
          </div>
          <Field name="default_interest_rate" label="Default Interest Rate (%)" defaultValue={initialAnswers.default_interest_rate} type="number" />
          <ComputedField
            name="monthly_pi_payment"
            label="Monthly P&I Payment ($)"
            value={computedMonthlyPI.toFixed(2)}
            hint="Standard amortization on the financed amount, rate, and term below."
          />
          <ComputedField
            name="monthly_escrow_payment"
            label="Monthly Tax/Insurance Escrow ($)"
            value={computedMonthlyEscrow.toFixed(2)}
            hint="Computed from the annual tax/insurance bills below."
          />
          <div>
            <label className={labelClass} htmlFor="first_payment_date">
              First Payment Date
            </label>
            <input
              id="first_payment_date"
              name="first_payment_date"
              type="date"
              value={firstPaymentDate}
              onChange={(e) => setFirstPaymentDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="amortization_months">
              Amortization (months)
            </label>
            <input
              id="amortization_months"
              name="amortization_months"
              type="number"
              value={amortizationMonths}
              onChange={(e) => setAmortizationMonths(e.target.value)}
              className={inputClass}
            />
          </div>
          <Field name="balloon_date" label="Balloon / Payoff-By Date" defaultValue={initialAnswers.balloon_date} type="date" />
          <Field name="late_fee_amount" label="Late Fee ($)" defaultValue={initialAnswers.late_fee_amount} type="number" />
          <Field name="late_fee_grace_day" label="Late Fee Due-By Day of Month" defaultValue={initialAnswers.late_fee_grace_day} type="number" />
          <Field name="default_grace_days" label="Note Default Threshold (days)" defaultValue={initialAnswers.default_grace_days} type="number" />
        </div>
      </Card>

      <Card title="Closing Details">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="closing_date">
              Closing Date <span className="text-red-500">*</span>
            </label>
            <input
              id="closing_date"
              name="closing_date"
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <Field name="note_notary_date" label="Note Notary Date" defaultValue={initialAnswers.note_notary_date} type="date" />
          <Field name="signing_city" label="Signing City" defaultValue={initialAnswers.signing_city} />
          <Field name="notary_county" label="Notary County" defaultValue={initialAnswers.notary_county} />
          <div>
            <label className={labelClass}>Buyer Occupancy</label>
            <select
              name="occupancy_type"
              value={occupancyType}
              onChange={(e) => setOccupancyType(e.target.value)}
              className={inputClass}
            >
              <option value="PRIMARY">Primary Residence</option>
              <option value="INVESTMENT">Investment / Rental</option>
            </select>
          </div>
          <Field name="occupancy_percent" label="Occupancy % (PRE Affidavit)" defaultValue={initialAnswers.occupancy_percent} type="number" />
        </div>
      </Card>

      <Card title="Closing Statement — Escrow Reserve, Commissions &amp; Fees">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field name="earnest_money_deposit" label="Earnest Money Deposit ($)" defaultValue={initialAnswers.earnest_money_deposit} type="number" />
          <div>
            <label className={labelClass} htmlFor="escrow_cushion_months">
              Escrow Cushion (months)
            </label>
            <input
              id="escrow_cushion_months"
              name="escrow_cushion_months"
              type="number"
              value={escrowCushionMonths}
              onChange={(e) => setEscrowCushionMonths(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Buyer&apos;s New Escrow Reserve</p>
        <p className="mb-2 text-xs text-slate-400">
          This funds the buyer&apos;s own new escrow account — never a seller proration. The annual bill ÷ 12 becomes the ongoing monthly
          escrow payment above; the reserve due at closing covers whatever part of the current bill cycle isn&apos;t caught up by the
          buyer&apos;s own monthly payments yet, plus the cushion.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
          <EscrowReserveFields
            prefix="property_tax"
            label="Property Tax"
            annualAmount={propertyTaxAnnualAmount}
            onAnnualAmountChange={setPropertyTaxAnnualAmount}
            periodStart={propertyTaxPeriodStart}
            onPeriodStartChange={setPropertyTaxPeriodStart}
            firstPaymentDate={firstPaymentDate}
            cushionMonths={cushionMonthsNumber}
          />
          <EscrowReserveFields
            prefix="insurance"
            label="Homeowner's Insurance"
            annualAmount={insuranceAnnualAmount}
            onAnnualAmountChange={setInsuranceAnnualAmount}
            firstPaymentDate={firstPaymentDate}
            cushionMonths={cushionMonthsNumber}
          />
          <EscrowReserveFields
            prefix="city_property_tax"
            label="City Property Tax"
            annualAmount={cityTaxAnnualAmount}
            onAnnualAmountChange={setCityTaxAnnualAmount}
            periodStart={cityTaxPeriodStart}
            onPeriodStartChange={setCityTaxPeriodStart}
            firstPaymentDate={firstPaymentDate}
            cushionMonths={cushionMonthsNumber}
          />
        </div>

        <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Commissions &amp; Fees</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field name="buyer_broker_name" label="Buyer's Broker (if any)" defaultValue={initialAnswers.buyer_broker_name} />
          <SmartDefaultField
            name="buyer_broker_commission"
            label="Buyer Broker Commission ($)"
            basis={purchasePriceNumber}
            percent={3}
            initialValue={initialAnswers.buyer_broker_commission}
          />
          <Field name="listing_broker_name" label="Listing Broker (if any)" defaultValue={initialAnswers.listing_broker_name} />
          <SmartDefaultField
            name="listing_broker_commission"
            label="Listing Broker Commission ($)"
            basis={purchasePriceNumber}
            percent={3}
            initialValue={initialAnswers.listing_broker_commission}
          />
          <SmartDefaultField
            name="loan_origination_fee"
            label="Loan Origination Fee ($)"
            basis={purchasePriceNumber}
            percent={2.5}
            initialValue={initialAnswers.loan_origination_fee}
          />
          <ComputedField
            name="prepaid_interest"
            label="Prepaid Interest ($)"
            value={computedPrepaidInterest.toFixed(2)}
            hint="Per-diem interest on the financed amount from closing to the first covered payment period."
          />
          <Field name="city_taxes_paid_by_seller" label="City Taxes Paid By Seller ($)" defaultValue={initialAnswers.city_taxes_paid_by_seller} type="number" />
          <Field name="county_taxes_paid_by_seller" label="County Taxes Paid By Seller ($)" defaultValue={initialAnswers.county_taxes_paid_by_seller} type="number" />
        </div>
      </Card>

      <div className="sticky bottom-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
        <button
          type="submit"
          name="intent"
          value="save"
          disabled={pending}
          className="rounded-md border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save Draft"}
        </button>
        <button
          type="submit"
          name="intent"
          value="publish"
          disabled={pending}
          className="rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Publishing…" : "Publish Package"}
        </button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.success && (
          <p className="text-sm text-emerald-700">
            {state.success}
            {state.driveFolderUrl && (
              <>
                {" — "}
                <a href={state.driveFolderUrl} target="_blank" rel="noreferrer" className="underline">
                  Open in Drive
                </a>
              </>
            )}
          </p>
        )}
      </div>
    </form>
  );
}
