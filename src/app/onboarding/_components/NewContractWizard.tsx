"use client";

import { useActionState, useRef, useState } from "react";
import { createLandContractAction, type CreateLandContractState } from "../manual/actions";
import StepBorrowers from "./StepBorrowers";
import StepProperty from "./StepProperty";
import StepContractAndEscrow from "./StepContractAndEscrow";

const STEPS = ["Borrower & Co-Borrower", "Property", "Land Contract & Escrow"] as const;

// Every field the wizard can pre-fill — shared by manual entry (nothing
// passed, everything blank) and the Import flow (extracted values passed
// in). All optional/nullable since extraction may not find everything.
export interface LandContractInitialValues {
  borrowerPartyType?: "INDIVIDUAL" | "BUSINESS" | null;
  borrowerFirstName?: string | null;
  borrowerLastName?: string | null;
  borrowerMiddleInitial?: string | null;
  borrowerSalutation?: string | null;
  borrowerCompanyName?: string | null;
  borrowerEmail?: string | null;
  borrowerPhone?: string | null;
  hasCoBorrower?: boolean | null;
  coBorrowerPartyType?: "INDIVIDUAL" | "BUSINESS" | null;
  coBorrowerFirstName?: string | null;
  coBorrowerLastName?: string | null;
  coBorrowerMiddleInitial?: string | null;
  coBorrowerSalutation?: string | null;
  coBorrowerCompanyName?: string | null;
  coBorrowerEmail?: string | null;
  coBorrowerPhone?: string | null;

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
  initial,
  highlightMissing,
}: {
  suggestedContractNumber: string;
  initial?: LandContractInitialValues;
  // True only for the Import flow — manual entry's blank fields are just
  // blank, not "missing"; extracted data that came back empty genuinely
  // needs a staff member's eyes on it.
  highlightMissing?: boolean;
}) {
  const [step, setStep] = useState(1);
  const [state, formAction, pending] = useActionState<CreateLandContractState | undefined, FormData>(
    createLandContractAction,
    undefined
  );

  const step1Ref = useRef<HTMLFieldSetElement>(null);
  const step2Ref = useRef<HTMLFieldSetElement>(null);
  const step3Ref = useRef<HTMLFieldSetElement>(null);
  const refs = [step1Ref, step2Ref, step3Ref];

  function goNext() {
    const currentRef = refs[step - 1];
    if (currentRef.current && !currentRef.current.checkValidity()) {
      currentRef.current.reportValidity();
      return;
    }
    setStep((s) => Math.min(3, s + 1));
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  // The form stays mounted across all 3 steps (only visibility toggles) so
  // nothing is lost moving Back/Next — but that means the browser's own
  // submit-time validation would try to validate/focus fields on hidden
  // steps too, which it can't do reliably. noValidate defers ALL validation
  // to the explicit checkValidity()/reportValidity() calls here, which only
  // ever run against the step that's actually visible at the time.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
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
        <StepProperty initial={initial} highlightMissing={highlightMissing} />
      </fieldset>
      <fieldset ref={step3Ref} className={step === 3 ? "" : "hidden"}>
        <StepContractAndEscrow suggestedContractNumber={suggestedContractNumber} initial={initial} highlightMissing={highlightMissing} />
      </fieldset>

      {state?.error && <p className="mt-4 text-sm text-red-600">{state.error}</p>}

      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 1}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Back
        </button>
        {step < 3 ? (
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
            disabled={pending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? "Creating..." : "Create Contract"}
          </button>
        )}
      </div>
    </form>
  );
}
