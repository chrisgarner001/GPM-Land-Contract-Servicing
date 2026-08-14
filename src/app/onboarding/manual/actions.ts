"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { parties, partyTypeEnum, propertyTypeEnum, properties } from "@/db/schema/parties";
import {
  contracts,
  contractParties,
  interestMethodEnum,
  lienPriorityEnum,
  loanTypeEnum,
  paymentFrequencyEnum,
  lateFeeTypeEnum,
} from "@/db/schema/contracts";
import { escrowAnalyses } from "@/db/schema/escrow";
import { runEscrowAnalysis } from "@/domain/escrow/runEscrowAnalysis";

export interface CreateLandContractState {
  error?: string;
}

function trimmedOrNull(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function dollarsToCents(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isFinite(cents) ? cents : null;
}

function enumOrDefault<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

interface PersonInput {
  partyType: "INDIVIDUAL" | "BUSINESS";
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  middleInitial: string | null;
  salutation: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
}

// Returns null (not an error) when the prefix has no name at all — used for
// the co-borrower, which is entirely optional.
function readPerson(formData: FormData, prefix: string): PersonInput | null {
  const partyType = enumOrDefault(formData.get(`${prefix}PartyType`), partyTypeEnum.enumValues, "INDIVIDUAL");
  const firstName = trimmedOrNull(formData.get(`${prefix}FirstName`));
  const lastName = trimmedOrNull(formData.get(`${prefix}LastName`));
  const companyName = trimmedOrNull(formData.get(`${prefix}CompanyName`));

  const displayName = partyType === "INDIVIDUAL" ? [firstName, lastName].filter(Boolean).join(" ") : companyName ?? "";
  if (!displayName.trim()) return null;

  return {
    partyType,
    displayName: displayName.trim(),
    firstName: partyType === "INDIVIDUAL" ? firstName : null,
    lastName: partyType === "INDIVIDUAL" ? lastName : null,
    middleInitial: partyType === "INDIVIDUAL" ? trimmedOrNull(formData.get(`${prefix}MiddleInitial`)) : null,
    salutation: partyType === "INDIVIDUAL" ? trimmedOrNull(formData.get(`${prefix}Salutation`)) : null,
    companyName: partyType === "BUSINESS" ? companyName : null,
    email: trimmedOrNull(formData.get(`${prefix}Email`)),
    phone: trimmedOrNull(formData.get(`${prefix}Phone`)),
  };
}

export async function createLandContractAction(
  _prevState: CreateLandContractState | undefined,
  formData: FormData
): Promise<CreateLandContractState> {
  const borrower = readPerson(formData, "borrower");
  if (!borrower) {
    return { error: "Borrower name is required." };
  }

  const hasCoBorrower = formData.get("hasCoBorrower") === "1";
  const coBorrower = hasCoBorrower ? readPerson(formData, "coBorrower") : null;
  if (hasCoBorrower && !coBorrower) {
    return { error: "Co-Borrower name is required, or remove the co-borrower." };
  }

  const streetAddress = trimmedOrNull(formData.get("streetAddress"));
  const city = trimmedOrNull(formData.get("city"));
  const state = trimmedOrNull(formData.get("state"));
  const zip = trimmedOrNull(formData.get("zip"));
  const county = trimmedOrNull(formData.get("county"));
  if (!streetAddress || !city || !state || !zip || !county) {
    return { error: "Street Address, City, State, Zip, and County are all required." };
  }
  const propertyType = enumOrDefault(formData.get("propertyType"), propertyTypeEnum.enumValues, "SINGLE_FAMILY");

  const contractNumber = trimmedOrNull(formData.get("contractNumber"));
  const purchasePriceCents = dollarsToCents(formData.get("purchasePrice"));
  const downPaymentCents = dollarsToCents(formData.get("downPayment"));
  const originalPrincipalCents = dollarsToCents(formData.get("originalPrincipal"));
  const interestRateAnnual = Number(formData.get("interestRateAnnual"));
  const amortizationTermMonths = Number(formData.get("amortizationTermMonths"));
  const paymentAmountCents = dollarsToCents(formData.get("paymentAmount"));
  const originationDate = trimmedOrNull(formData.get("originationDate"));
  const firstPaymentDate = trimmedOrNull(formData.get("firstPaymentDate"));
  const maturityDate = trimmedOrNull(formData.get("maturityDate"));

  if (!contractNumber) return { error: "Contract Number is required." };
  if (purchasePriceCents === null || purchasePriceCents < 0) return { error: "Enter a valid Purchase Price." };
  if (downPaymentCents === null || downPaymentCents < 0) return { error: "Enter a valid Down Payment." };
  if (originalPrincipalCents === null || originalPrincipalCents < 0) return { error: "Enter a valid Original Principal Balance." };
  if (!Number.isFinite(interestRateAnnual) || interestRateAnnual < 0) return { error: "Enter a valid Interest Rate." };
  if (!Number.isFinite(amortizationTermMonths) || amortizationTermMonths <= 0) return { error: "Enter a valid Amortization Term." };
  if (paymentAmountCents === null || paymentAmountCents < 0) return { error: "Enter a valid Payment Amount." };
  if (!originationDate) return { error: "Origination Date is required." };
  if (!firstPaymentDate) return { error: "First Payment Date is required." };

  const interestMethod = enumOrDefault(formData.get("interestMethod"), interestMethodEnum.enumValues, "SIMPLE_30_360");
  const loanType = enumOrDefault(formData.get("loanType"), loanTypeEnum.enumValues, "LAND_CONTRACT");
  const lienPriority = enumOrDefault(formData.get("lienPriority"), lienPriorityEnum.enumValues, "1ST");
  const paymentFrequency = enumOrDefault(formData.get("paymentFrequency"), paymentFrequencyEnum.enumValues, "MONTHLY");
  const lateFeeType = enumOrDefault(formData.get("lateFeeType"), lateFeeTypeEnum.enumValues, "FLAT");
  const lateFeeAmountCents = lateFeeType === "FLAT" ? dollarsToCents(formData.get("lateFeeAmount")) : null;
  const lateFeePercentRaw = lateFeeType !== "FLAT" ? Number(formData.get("lateFeePercent")) : null;
  const lateFeeGraceDaysRaw = trimmedOrNull(formData.get("lateFeeGraceDays"));
  const lateFeeGraceDays = lateFeeGraceDaysRaw ? Number(lateFeeGraceDaysRaw) : null;

  const hasBalloon = formData.get("hasBalloon") === "1";
  const balloonAmountCents = hasBalloon ? dollarsToCents(formData.get("balloonAmount")) : null;
  const balloonDueDate = hasBalloon ? trimmedOrNull(formData.get("balloonDueDate")) : null;
  if (hasBalloon && (balloonAmountCents === null || !balloonDueDate)) {
    return { error: "Enter a valid Balloon Amount and Due Date, or uncheck Has Balloon Payment." };
  }

  const escrowRequired = formData.get("escrowRequired") === "1";
  const projectedAnnualTaxCents = escrowRequired ? dollarsToCents(formData.get("projectedAnnualTax")) : null;
  const projectedAnnualInsuranceCents = escrowRequired ? dollarsToCents(formData.get("projectedAnnualInsurance")) : null;
  const startingEscrowBalanceCents = escrowRequired ? dollarsToCents(formData.get("startingEscrowBalance")) ?? 0 : null;
  if (escrowRequired && (projectedAnnualTaxCents === null || projectedAnnualInsuranceCents === null)) {
    return { error: "Enter valid Projected Annual Tax and Insurance amounts, or uncheck Escrow Required." };
  }

  const [existing] = await db.select({ id: contracts.id }).from(contracts).where(eq(contracts.contractNumber, contractNumber));
  if (existing) {
    return { error: `Contract Number "${contractNumber}" is already in use.` };
  }

  const contractId = await db.transaction(async (tx) => {
    const [borrowerParty] = await tx
      .insert(parties)
      .values({
        partyType: borrower.partyType,
        displayName: borrower.displayName,
        firstName: borrower.firstName,
        lastName: borrower.lastName,
        middleInitial: borrower.middleInitial,
        salutation: borrower.salutation,
        companyName: borrower.companyName,
        email: borrower.email,
        phone: borrower.phone,
      })
      .returning({ id: parties.id });

    const coBorrowerParty = coBorrower
      ? (
          await tx
            .insert(parties)
            .values({
              partyType: coBorrower.partyType,
              displayName: coBorrower.displayName,
              firstName: coBorrower.firstName,
              lastName: coBorrower.lastName,
              middleInitial: coBorrower.middleInitial,
              salutation: coBorrower.salutation,
              companyName: coBorrower.companyName,
              email: coBorrower.email,
              phone: coBorrower.phone,
            })
            .returning({ id: parties.id })
        )[0]
      : null;

    const [property] = await tx
      .insert(properties)
      .values({
        streetAddress,
        city,
        state,
        zip,
        county,
        parcelNumber: trimmedOrNull(formData.get("parcelNumber")),
        legalDescription: trimmedOrNull(formData.get("legalDescription")),
        propertyType,
      })
      .returning({ id: properties.id });

    const [contract] = await tx
      .insert(contracts)
      .values({
        contractNumber,
        propertyId: property.id,
        purchasePriceCents,
        downPaymentCents,
        originalPrincipalCents,
        currentPrincipalBalanceCents: originalPrincipalCents,
        interestRateAnnual: interestRateAnnual.toFixed(4),
        interestMethod,
        loanType,
        lienPriority,
        amortizationTermMonths,
        paymentAmountCents,
        paymentFrequency,
        originationDate,
        firstPaymentDate,
        maturityDate,
        nextPaymentDate: firstPaymentDate,
        hasBalloon,
        balloonAmountCents,
        balloonDueDate,
        lateFeeType,
        lateFeeAmountCents,
        lateFeePercent: lateFeePercentRaw !== null && Number.isFinite(lateFeePercentRaw) ? lateFeePercentRaw.toFixed(2) : null,
        lateFeeGraceDays,
        escrowRequired,
      })
      .returning({ id: contracts.id });

    await tx.insert(contractParties).values({ contractId: contract.id, partyId: borrowerParty.id, role: "BUYER" });
    if (coBorrowerParty) {
      await tx.insert(contractParties).values({ contractId: contract.id, partyId: coBorrowerParty.id, role: "CO_BUYER" });
    }

    if (escrowRequired && projectedAnnualTaxCents !== null && projectedAnnualInsuranceCents !== null) {
      const today = new Date().toISOString().slice(0, 10);
      const result = runEscrowAnalysis({
        currentEscrowBalanceCents: startingEscrowBalanceCents ?? 0,
        currentMonthlyEscrowPaymentCents: 0,
        projectedAnnualTaxCents,
        projectedAnnualInsuranceCents,
      });

      await tx.insert(escrowAnalyses).values({
        contractId: contract.id,
        analysisDate: today,
        effectiveDate: today,
        trigger: "ONBOARDING",
        projectedAnnualTaxCents,
        projectedAnnualInsuranceCents,
        cushionTargetCents: result.cushionTargetCents,
        currentEscrowBalanceCents: startingEscrowBalanceCents ?? 0,
        currentMonthlyEscrowPaymentCents: 0,
        projectedEndingBalanceCents: result.projectedEndingBalanceCents,
        shortageOrSurplusCents: result.shortageOrSurplusCents,
        newMonthlyEscrowPaymentCents: result.newMonthlyEscrowPaymentCents,
      });
    }

    return contract.id;
  });

  redirect(`/contracts/${contractId}`);
}
