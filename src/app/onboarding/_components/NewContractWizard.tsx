"use client";

import { useActionState, useRef, useState } from "react";
import { createLandContractAction, submitContractDraftAction, type WizardFormState } from "../manual/actions";
import StepBorrowers from "./StepBorrowers";
import StepLender from "./StepLender";
import StepProperty from "./StepProperty";
import StepContractAndEscrow from "./StepContractAndEscrow";

const STEPS = ["Borrower & Co-Borrower", "Lender", "Property", "Land Contract & Escrow"] as const;

// Every field the wizard can pre-fill — shared by manual entry (nothing
// passed, everything blank), the Import flow (extracted values passed in),
// and resuming a saved draft (every field the person filled in last time).
// All optional/nullable since extraction/a partial draft may not have
// everything. Note booleans round-trip as the literal form value ("1" or
// absent) when coming from a draft, not real booleans — every consumer
// reads them via Boolean(...), which treats both representations correctly.
export interface LandContractInitialValues {
  borrowerPartyType?: "INDIVIDUAL" | "BUSINESS" | null;
  borrowerFirstName?: string | null;
  borrowerLastName?: string | null;
  borrowerMiddleInitial?: string | null;
  borrowerSalutation?: string | null;
  borrowerCompanyName?: string | null;
  borrowerEmail?: string | null;
  borrowerEmailFormat?: "HTML" | "TEXT" | null;
  borrowerPhone?: string | null;
  borrowerPhoneHome?: string | null;
  borrowerPhoneWork?: string | null;
  borrowerPhoneMobile?: string | null;
  borrowerPhoneFax?: string | null;
  borrowerMailingAddressLine1?: string | null;
  borrowerMailingAddressLine2?: string | null;
  borrowerMailingCity?: string | null;
  borrowerMailingState?: string | null;
  borrowerMailingZip?: string | null;
  borrowerMailingCountry?: string | null;
  borrowerTaxId?: string | null;
  borrowerTinType?: "SSN" | "EIN" | null;
  borrowerLegalStructure?: string | null;
  borrowerDateOfBirth?: string | null;
  borrowerAlternateTaxInfo?: string | null;
  borrowerDeliveryByPrint?: boolean | string | null;
  borrowerDeliveryByEmail?: boolean | string | null;
  borrowerDeliveryBySms?: boolean | string | null;
  borrowerSendTaxReporting?: boolean | string | null;
  borrowerSendLateNotices?: boolean | string | null;
  borrowerSendPaymentReceipts?: boolean | string | null;
  borrowerSendPaymentStatements?: boolean | string | null;
  hasCoBorrower?: boolean | string | null;
  coBorrowerPartyType?: "INDIVIDUAL" | "BUSINESS" | null;
  coBorrowerFirstName?: string | null;
  coBorrowerLastName?: string | null;
  coBorrowerMiddleInitial?: string | null;
  coBorrowerSalutation?: string | null;
  coBorrowerCompanyName?: string | null;
  coBorrowerEmail?: string | null;
  coBorrowerEmailFormat?: "HTML" | "TEXT" | null;
  coBorrowerPhone?: string | null;
  coBorrowerPhoneHome?: string | null;
  coBorrowerPhoneWork?: string | null;
  coBorrowerPhoneMobile?: string | null;
  coBorrowerPhoneFax?: string | null;
  coBorrowerMailingAddressLine1?: string | null;
  coBorrowerMailingAddressLine2?: string | null;
  coBorrowerMailingCity?: string | null;
  coBorrowerMailingState?: string | null;
  coBorrowerMailingZip?: string | null;
  coBorrowerMailingCountry?: string | null;
  coBorrowerTaxId?: string | null;
  coBorrowerTinType?: "SSN" | "EIN" | null;
  coBorrowerLegalStructure?: string | null;
  coBorrowerDateOfBirth?: string | null;
  coBorrowerAlternateTaxInfo?: string | null;
  coBorrowerDeliveryByPrint?: boolean | string | null;
  coBorrowerDeliveryByEmail?: boolean | string | null;
  coBorrowerDeliveryBySms?: boolean | string | null;
  coBorrowerSendTaxReporting?: boolean | string | null;
  coBorrowerSendLateNotices?: boolean | string | null;
  coBorrowerSendPaymentReceipts?: boolean | string | null;
  coBorrowerSendPaymentStatements?: boolean | string | null;

  lenderMode?: "existing" | "new" | null;
  lenderExistingPartyId?: string | null;
  lenderNewPartyType?: "INDIVIDUAL" | "BUSINESS" | null;
  lenderDisplayName?: string | null;
  lenderFirstName?: string | null;
  lenderLastName?: string | null;
  lenderEmail?: string | null;
  lenderPhone?: string | null;
  lenderMailingAddressLine1?: string | null;
  lenderMailingCity?: string | null;
  lenderMailingState?: string | null;
  lenderMailingZip?: string | null;
  lenderPortalPin?: string | null;
  lenderPreferredPaymentMethod?: "CHECK" | "ACH" | null;
  lenderTaxId?: string | null;
  lenderAchBankName?: string | null;
  lenderAchRoutingNumber?: string | null;
  lenderAchAccountNumber?: string | null;
  lenderFundedAmount?: string | null;
  lenderOwnershipPercent?: string | null;
  lenderInterestRate?: string | null;
  lenderFundingDate?: string | null;
  lenderServicingFee?: string | null;

  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  county?: string | null;
  parcelNumber?: string | null;
  legalDescription?: string | null;
  propertyType?: "SINGLE_FAMILY" | "MULTI_FAMILY" | "COMMERCIAL" | "OTHER" | null;

  contractNumber?: string | null;
  loanType?: "LAND_CONTRACT" | "FIRST_LIEN" | "SECOND_LIEN" | "UNSECURED" | null;
  purchasePrice?: string | null;
  downPayment?: string | null;
  originalPrincipal?: string | null;
  interestRateAnnual?: string | null;
  interestMethod?: "SIMPLE_30_360" | "SIMPLE_ACTUAL_365" | null;
  amortizationTermMonths?: string | null;
  lienPriority?: string | null;
  paymentAmount?: string | null;
  paymentFrequency?: "MONTHLY" | "SEMI_MONTHLY" | "BIWEEKLY" | null;
  originationDate?: string | null;
  firstPaymentDate?: string | null;
  maturityDate?: string | null;
  lateFeeType?: "FLAT" | "PERCENT_OF_PI" | "PERCENT_OF_TOTAL_PAYMENT" | null;
  lateFeeAmount?: string | null;
  lateFeePercent?: string | null;
  lateFeeGraceDays?: string | null;
  hasBalloon?: boolean | null;
  balloonAmount?: string | null;
  balloonDueDate?: string | null;
  escrowRequired?: boolean | null;
  projectedAnnualTax?: string | null;
  projectedAnnualInsurance?: string | null;
  startingEscrowBalance?: string | null;
}

export default function NewContractWizard({
  suggestedContractNumber,
  existingLenders,
  initial,
  highlightMissing,
  draftId,
}: {
  suggestedContractNumber: string;
  existingLenders: { id: string; displayName: string }[];
  initial?: LandContractInitialValues;
  // True only for the Import flow — manual entry's blank fields are just
  // blank, not "missing"; extracted data that came back empty genuinely
  // needs a staff member's eyes on it.
  highlightMissing?: boolean;
  // Present for the Manual entry flow (a saved draft backs the wizard, so a
  // "Save Draft" button is available on every step and Create Contract also
  // marks the draft published). Absent for the Import flow, which still
  // submits once at the end with no draft persistence.
  draftId?: string;
}) {
  const [step, setStep] = useState(1);
  const action = draftId ? submitContractDraftAction.bind(null, draftId) : createLandContractAction;
  const [state, formAction, pending] = useActionState<WizardFormState | undefined, FormData>(action, undefined);

  const step1Ref = useRef<HTMLFieldSetElement>(null);
  const step2Ref = useRef<HTMLFieldSetElement>(null);
  const step3Ref = useRef<HTMLFieldSetElement>(null);
  const step4Ref = useRef<HTMLFieldSetElement>(null);
  const refs = [step1Ref, step2Ref, step3Ref, step4Ref];

  function goNext() {
    const currentRef = refs[step - 1];
    if (currentRef.current && !currentRef.current.checkValidity()) {
      currentRef.current.reportValidity();
      return;
    }
    setStep((s) => Math.min(STEPS.length, s + 1));
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  // The form stays mounted across all 4 steps (only visibility toggles) so
  // nothing is lost moving Back/Next — but that means the browser's own
  // submit-time validation would try to validate/focus fields on hidden
  // steps too, which it can't do reliably. noValidate defers ALL validation
  // to the explicit checkValidity()/reportValidity() calls here, which only
  // ever run against the step that's actually visible at the time.
  //
  // Save Draft is exempt — it's meant to work with whatever's filled in so
  // far, from any step, so it skips this validation loop entirely.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.name === "intent" && submitter.value === "save") return;

    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      if (ref.current && !ref.current.checkValidity()) {
        e.preventDefault();
        setStep(i + 1);
        requestAnimationFrame(() => ref.current?.reportValidity());
        return;
      }
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <ol className="mb-6 flex items-center gap-2 text-xs font-medium text-slate-500">
        {STEPS.map((label, i) => (
          <li key={label} className={`flex items-center gap-2 ${i + 1 === step ? "text-slate-900" : ""}`}>
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                i + 1 === step ? "bg-slate-900 text-white" : i + 1 < step ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
              }`}
            >
              {i + 1}
            </span>
            {label}
            {i < STEPS.length - 1 && <span className="mx-1 text-slate-300">›</span>}
          </li>
        ))}
      </ol>

      <fieldset ref={step1Ref} className={step === 1 ? "" : "hidden"}>
        <StepBorrowers initial={initial} highlightMissing={highlightMissing} />
      </fieldset>
      <fieldset ref={step2Ref} className={step === 2 ? "" : "hidden"}>
        <StepLender existingLenders={existingLenders} initial={initial} />
      </fieldset>
      <fieldset ref={step3Ref} className={step === 3 ? "" : "hidden"}>
        <StepProperty initial={initial} highlightMissing={highlightMissing} />
      </fieldset>
      <fieldset ref={step4Ref} className={step === 4 ? "" : "hidden"}>
        <StepContractAndEscrow suggestedContractNumber={suggestedContractNumber} initial={initial} highlightMissing={highlightMissing} />
      </fieldset>

      {state?.error && <p className="mt-4 text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="mt-4 text-sm text-emerald-700">{state.success}</p>}

      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 1}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Back
        </button>
        <div className="flex items-center gap-3">
          {draftId && (
            <button
              type="submit"
              name="intent"
              value="save"
              disabled={pending}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {pending ? "Saving..." : "Save Draft"}
            </button>
          )}
          {step < STEPS.length ? (
            <button
              type="button"
              onClick={goNext}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Next
            </button>
          ) : (
            <button
              type="submit"
              name="intent"
              value="create"
              disabled={pending}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {pending ? "Creating..." : "Create Contract"}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
