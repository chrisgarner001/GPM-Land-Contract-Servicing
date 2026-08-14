"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { parties, partyTypeEnum, propertyTypeEnum, properties, emailFormatEnum, tinTypeEnum } from "@/db/schema/parties";
import {
  contracts,
  contractParties,
  interestMethodEnum,
  lienPriorityEnum,
  loanTypeEnum,
  paymentFrequencyEnum,
  lateFeeTypeEnum,
} from "@/db/schema/contracts";
import { contractOnboardingDrafts } from "@/db/schema/contractOnboardingDrafts";
import { escrowAnalyses, trustLedgerEntries } from "@/db/schema/escrow";
import { runEscrowAnalysis } from "@/domain/escrow/runEscrowAnalysis";
import { encryptPII } from "@/lib/encryption";
import { createClient } from "@/lib/supabase/server";
import { requireEditAccess } from "@/lib/staffRole";
import {
  createContractDraft,
  getContractDraft,
  saveContractDraft,
  deleteContractDraft,
  type ContractDraftAnswers,
} from "@/server/contractDrafts";

// Shared by createLandContractAction (Import flow, no draft) and
// submitContractDraftAction (Manual entry flow, draft-backed) so
// NewContractWizard's single useActionState hook can bind either one.
export interface WizardFormState {
  error?: string;
  success?: string;
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
  emailFormat: "HTML" | "TEXT";
  phoneHome: string | null;
  phoneWork: string | null;
  phoneMobile: string | null;
  phoneFax: string | null;
  mailingAddressLine1: string | null;
  mailingAddressLine2: string | null;
  mailingCity: string | null;
  mailingState: string | null;
  mailingZip: string | null;
  mailingCountry: string | null;
  taxId: string | null;
  tinType: "SSN" | "EIN";
  legalStructure: string | null;
  dateOfBirth: string | null;
  alternateTaxInfo: string | null;
  deliveryByPrint: boolean;
  deliveryByEmail: boolean;
  deliveryBySms: boolean;
  sendTaxReporting: boolean;
  sendLateNotices: boolean;
  sendPaymentReceipts: boolean;
  sendPaymentStatements: boolean;
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
    emailFormat: enumOrDefault(formData.get(`${prefix}EmailFormat`), emailFormatEnum.enumValues, "HTML"),
    phoneHome: trimmedOrNull(formData.get(`${prefix}PhoneHome`)),
    phoneWork: trimmedOrNull(formData.get(`${prefix}PhoneWork`)),
    phoneMobile: trimmedOrNull(formData.get(`${prefix}PhoneMobile`)),
    phoneFax: trimmedOrNull(formData.get(`${prefix}PhoneFax`)),
    mailingAddressLine1: trimmedOrNull(formData.get(`${prefix}MailingAddressLine1`)),
    mailingAddressLine2: trimmedOrNull(formData.get(`${prefix}MailingAddressLine2`)),
    mailingCity: trimmedOrNull(formData.get(`${prefix}MailingCity`)),
    mailingState: trimmedOrNull(formData.get(`${prefix}MailingState`)),
    mailingZip: trimmedOrNull(formData.get(`${prefix}MailingZip`)),
    mailingCountry: trimmedOrNull(formData.get(`${prefix}MailingCountry`)),
    taxId: trimmedOrNull(formData.get(`${prefix}TaxId`)),
    tinType: enumOrDefault(formData.get(`${prefix}TinType`), tinTypeEnum.enumValues, "SSN"),
    legalStructure: trimmedOrNull(formData.get(`${prefix}LegalStructure`)),
    dateOfBirth: trimmedOrNull(formData.get(`${prefix}DateOfBirth`)),
    alternateTaxInfo: trimmedOrNull(formData.get(`${prefix}AlternateTaxInfo`)),
    deliveryByPrint: formData.get(`${prefix}DeliveryByPrint`) === "1",
    deliveryByEmail: formData.get(`${prefix}DeliveryByEmail`) === "1",
    deliveryBySms: formData.get(`${prefix}DeliveryBySms`) === "1",
    sendTaxReporting: formData.get(`${prefix}SendTaxReporting`) === "1",
    sendLateNotices: formData.get(`${prefix}SendLateNotices`) === "1",
    sendPaymentReceipts: formData.get(`${prefix}SendPaymentReceipts`) === "1",
    sendPaymentStatements: formData.get(`${prefix}SendPaymentStatements`) === "1",
  };
}

function readPersonInsertValues(person: PersonInput) {
  return {
    partyType: person.partyType,
    displayName: person.displayName,
    firstName: person.firstName,
    lastName: person.lastName,
    middleInitial: person.middleInitial,
    salutation: person.salutation,
    companyName: person.companyName,
    email: person.email,
    emailFormat: person.emailFormat,
    phoneHome: person.phoneHome,
    phoneWork: person.phoneWork,
    phoneMobile: person.phoneMobile,
    phoneFax: person.phoneFax,
    mailingAddressLine1: person.mailingAddressLine1,
    mailingAddressLine2: person.mailingAddressLine2,
    mailingCity: person.mailingCity,
    mailingState: person.mailingState,
    mailingZip: person.mailingZip,
    mailingCountry: person.mailingCountry,
    tinType: person.tinType,
    legalStructure: person.legalStructure,
    dateOfBirth: person.dateOfBirth,
    alternateTaxInfo: person.alternateTaxInfo,
    deliveryByPrint: person.deliveryByPrint,
    deliveryByEmail: person.deliveryByEmail,
    deliveryBySms: person.deliveryBySms,
    sendTaxReporting: person.sendTaxReporting,
    sendLateNotices: person.sendLateNotices,
    sendPaymentReceipts: person.sendPaymentReceipts,
    sendPaymentStatements: person.sendPaymentStatements,
    ...(person.taxId ? { taxIdEncrypted: encryptPII(person.taxId), taxIdLast4: person.taxId.slice(-4) } : {}),
  };
}

function collectAnswers(formData: FormData): ContractDraftAnswers {
  const answers: ContractDraftAnswers = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && key !== "intent") answers[key] = value;
  }
  return answers;
}

interface CreateLandContractResult {
  contractId?: string;
  error?: string;
}

// The actual Borrower+Lender+Property+Contract creation — shared by both the
// Import flow (no draft to link) and the Manual entry flow's "Create
// Contract" intent (draft-backed; on success the draft is marked PUBLISHED
// in the same transaction so it never comes back as an editable draft
// again — unlike land_contract_packages, creating a contract has real,
// non-idempotent side effects, so this can't safely run twice).
async function createLandContract(
  formData: FormData,
  linkDraft?: { id: string; updatedBy: string | null }
): Promise<CreateLandContractResult> {
  const borrower = readPerson(formData, "borrower");
  if (!borrower) {
    return { error: "Borrower name is required." };
  }

  const hasCoBorrower = formData.get("hasCoBorrower") === "1";
  const coBorrower = hasCoBorrower ? readPerson(formData, "coBorrower") : null;
  if (hasCoBorrower && !coBorrower) {
    return { error: "Co-Borrower name is required, or remove the co-borrower." };
  }

  const lenderMode = formData.get("lenderMode");
  let lenderExistingPartyId: string | null = null;
  let newLender: {
    partyType: "INDIVIDUAL" | "BUSINESS";
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    mailingAddressLine1: string | null;
    mailingCity: string | null;
    mailingState: string | null;
    mailingZip: string | null;
    portalPin: string | null;
    preferredPaymentMethod: "CHECK" | "ACH" | null;
    taxId: string | null;
    achBankName: string | null;
    achRoutingNumber: string | null;
    achAccountNumber: string | null;
  } | null = null;

  if (lenderMode === "new") {
    const lenderDisplayName = trimmedOrNull(formData.get("lenderDisplayName"));
    if (!lenderDisplayName) return { error: "Lender name is required." };
    const lenderPartyType = enumOrDefault(formData.get("lenderNewPartyType"), partyTypeEnum.enumValues, "BUSINESS");
    const preferredPaymentMethodRaw = formData.get("lenderPreferredPaymentMethod");
    newLender = {
      partyType: lenderPartyType,
      displayName: lenderDisplayName,
      firstName: lenderPartyType === "INDIVIDUAL" ? trimmedOrNull(formData.get("lenderFirstName")) : null,
      lastName: lenderPartyType === "INDIVIDUAL" ? trimmedOrNull(formData.get("lenderLastName")) : null,
      email: trimmedOrNull(formData.get("lenderEmail")),
      phone: trimmedOrNull(formData.get("lenderPhone")),
      mailingAddressLine1: trimmedOrNull(formData.get("lenderMailingAddressLine1")),
      mailingCity: trimmedOrNull(formData.get("lenderMailingCity")),
      mailingState: trimmedOrNull(formData.get("lenderMailingState")),
      mailingZip: trimmedOrNull(formData.get("lenderMailingZip")),
      portalPin: trimmedOrNull(formData.get("lenderPortalPin")),
      preferredPaymentMethod:
        preferredPaymentMethodRaw === "CHECK" || preferredPaymentMethodRaw === "ACH" ? preferredPaymentMethodRaw : null,
      taxId: trimmedOrNull(formData.get("lenderTaxId")),
      achBankName: trimmedOrNull(formData.get("lenderAchBankName")),
      achRoutingNumber: trimmedOrNull(formData.get("lenderAchRoutingNumber")),
      achAccountNumber: trimmedOrNull(formData.get("lenderAchAccountNumber")),
    };
  } else {
    lenderExistingPartyId = trimmedOrNull(formData.get("lenderExistingPartyId"));
    if (!lenderExistingPartyId) return { error: "Select a lender, or switch to New Lender." };
  }

  const lenderFundedAmountCents = dollarsToCents(formData.get("lenderFundedAmount"));
  if (lenderFundedAmountCents === null || lenderFundedAmountCents <= 0) return { error: "Enter a valid Funded Amount for the lender." };
  const lenderOwnershipPercent = Number(formData.get("lenderOwnershipPercent"));
  if (!Number.isFinite(lenderOwnershipPercent) || lenderOwnershipPercent <= 0 || lenderOwnershipPercent > 100) {
    return { error: "Enter a valid lender Ownership percent (greater than 0, up to 100)." };
  }
  const lenderInterestRate = Number(formData.get("lenderInterestRate"));
  if (!Number.isFinite(lenderInterestRate) || lenderInterestRate < 0 || lenderInterestRate > 100) {
    return { error: "Enter a valid lender Interest Rate." };
  }
  const lenderFundingDate = trimmedOrNull(formData.get("lenderFundingDate"));
  if (!lenderFundingDate) return { error: "Lender Funding Date is required." };
  const lenderServicingFeeDollars = trimmedOrNull(formData.get("lenderServicingFee"));
  const lenderServicingFeeCents = lenderServicingFeeDollars ? dollarsToCents(formData.get("lenderServicingFee")) : null;

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
  // Only differs from Original Principal when taking over servicing of a
  // land contract already partway through its term — left blank, it's the
  // same brand-new-origination case as before.
  const currentPrincipalBalanceRaw = trimmedOrNull(formData.get("currentPrincipalBalance"));
  const interestRateAnnual = Number(formData.get("interestRateAnnual"));
  const amortizationTermMonths = Number(formData.get("amortizationTermMonths"));
  const paymentAmountCents = dollarsToCents(formData.get("paymentAmount"));
  const originationDate = trimmedOrNull(formData.get("originationDate"));
  const firstPaymentDate = trimmedOrNull(formData.get("firstPaymentDate"));
  // The LC's own first payment date is a historical fact; the date WE start
  // collecting can differ when taking over servicing mid-term. Left blank,
  // it's the same date, matching a brand-new origination.
  const nextPaymentDate = trimmedOrNull(formData.get("nextPaymentDate")) ?? firstPaymentDate;
  const maturityDate = trimmedOrNull(formData.get("maturityDate"));

  if (!contractNumber) return { error: "Contract Number is required." };
  if (purchasePriceCents === null || purchasePriceCents < 0) return { error: "Enter a valid Purchase Price." };
  if (downPaymentCents === null || downPaymentCents < 0) return { error: "Enter a valid Down Payment." };
  if (originalPrincipalCents === null || originalPrincipalCents < 0) return { error: "Enter a valid Original Principal Balance." };
  const currentPrincipalBalanceCents = currentPrincipalBalanceRaw ? dollarsToCents(formData.get("currentPrincipalBalance")) : originalPrincipalCents;
  if (currentPrincipalBalanceCents === null || currentPrincipalBalanceCents < 0) {
    return { error: "Enter a valid Current Principal Balance." };
  }
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
  // Straight from the land contract — never derived from the impound
  // balance or the tax/insurance projections below (those are historical
  // record-keeping only; see the schema comment on contracts.escrowRequired
  // / the Escrow Setup step's own note).
  const escrowPaymentCents = escrowRequired ? dollarsToCents(formData.get("escrowPayment")) : null;
  const projectedAnnualTaxCents = escrowRequired ? dollarsToCents(formData.get("projectedAnnualTax")) : null;
  const projectedAnnualInsuranceCents = escrowRequired ? dollarsToCents(formData.get("projectedAnnualInsurance")) : null;
  const startingEscrowBalanceCents = escrowRequired ? dollarsToCents(formData.get("startingEscrowBalance")) ?? 0 : null;
  if (escrowRequired && (escrowPaymentCents === null || escrowPaymentCents < 0)) {
    return { error: "Enter a valid Escrow Payment amount, or uncheck Escrow Required." };
  }
  if (escrowRequired && (projectedAnnualTaxCents === null || projectedAnnualInsuranceCents === null)) {
    return { error: "Enter valid Projected Annual Tax and Insurance amounts, or uncheck Escrow Required." };
  }

  const [existing] = await db.select({ id: contracts.id }).from(contracts).where(eq(contracts.contractNumber, contractNumber));
  if (existing) {
    return { error: `Contract Number "${contractNumber}" is already in use.` };
  }

  const contractId = await db.transaction(async (tx) => {
    const [borrowerParty] = await tx.insert(parties).values(readPersonInsertValues(borrower)).returning({ id: parties.id });

    const coBorrowerParty = coBorrower
      ? (await tx.insert(parties).values(readPersonInsertValues(coBorrower)).returning({ id: parties.id }))[0]
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
        currentPrincipalBalanceCents,
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
        nextPaymentDate,
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

    let lenderPartyId: string;
    if (newLender) {
      const [lenderParty] = await tx
        .insert(parties)
        .values({
          partyType: newLender.partyType,
          displayName: newLender.displayName,
          firstName: newLender.firstName,
          lastName: newLender.lastName,
          companyName: newLender.partyType === "BUSINESS" ? newLender.displayName : null,
          email: newLender.email,
          phone: newLender.phone,
          mailingAddressLine1: newLender.mailingAddressLine1,
          mailingCity: newLender.mailingCity,
          mailingState: newLender.mailingState,
          mailingZip: newLender.mailingZip,
          portalPin: newLender.portalPin,
          // Lenders earn interest income and need a 1099 — same default as
          // the standalone Add Lender form.
          sendTaxReporting: true,
          preferredPaymentMethod: newLender.preferredPaymentMethod,
          ...(newLender.taxId ? { taxIdEncrypted: encryptPII(newLender.taxId), taxIdLast4: newLender.taxId.slice(-4) } : {}),
          achBankName: newLender.achBankName,
          achRoutingNumber: newLender.achRoutingNumber,
          ...(newLender.achAccountNumber
            ? { achAccountNumberEncrypted: encryptPII(newLender.achAccountNumber), achAccountLast4: newLender.achAccountNumber.slice(-4) }
            : {}),
        })
        .returning({ id: parties.id });
      lenderPartyId = lenderParty.id;
    } else {
      lenderPartyId = lenderExistingPartyId!;
    }

    await tx.insert(contractParties).values({
      contractId: contract.id,
      partyId: lenderPartyId,
      role: "INVESTOR_PAYEE",
      ownershipPercent: lenderOwnershipPercent.toFixed(2),
      brokerServicingFeeCents: lenderServicingFeeCents,
      fundedAmountCents: lenderFundedAmountCents,
      interestRateAnnual: lenderInterestRate.toFixed(4),
      fundingDate: lenderFundingDate,
      endDate: null,
    });

    if (escrowRequired && projectedAnnualTaxCents !== null && projectedAnnualInsuranceCents !== null && escrowPaymentCents !== null) {
      const today = new Date().toISOString().slice(0, 10);
      // Informational only — projects where the impound balance would land
      // given the STATED escrow payment (never the other way around; the
      // payment amount comes straight from the land contract, full stop, and
      // is never adjusted to chase a cushion target here).
      const projection = runEscrowAnalysis({
        currentEscrowBalanceCents: startingEscrowBalanceCents ?? 0,
        currentMonthlyEscrowPaymentCents: escrowPaymentCents,
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
        cushionTargetCents: projection.cushionTargetCents,
        currentEscrowBalanceCents: startingEscrowBalanceCents ?? 0,
        currentMonthlyEscrowPaymentCents: escrowPaymentCents,
        projectedEndingBalanceCents: projection.projectedEndingBalanceCents,
        shortageOrSurplusCents: projection.shortageOrSurplusCents,
        // The land contract's stated figure, NOT projection.newMonthlyEscrowPaymentCents
        // — this row is a record of what's actually being collected, not a
        // recommendation this action decided to apply.
        newMonthlyEscrowPaymentCents: escrowPaymentCents,
      });

      // Every other page that shows "Escrow Balance" reads the running
      // balance off the most recent trust_ledger_entries row (see
      // getEscrowAndReserveBalances) — without this, a brand-new contract's
      // starting balance was only ever visible buried in the escrow
      // analysis history table above, never on the contract page itself.
      await tx.insert(trustLedgerEntries).values({
        contractId: contract.id,
        transactionDate: originationDate,
        description: "Opening escrow balance (onboarding)",
        amountReceivedCents: startingEscrowBalanceCents ?? 0,
        balanceCents: startingEscrowBalanceCents ?? 0,
        category: "IMPOUND",
      });

      // The real escrow amount billed on the contract's payments going
      // forward (see getCurrentEscrowPortionCents) — straight from the land
      // contract, exactly as entered above.
      await tx.update(contracts).set({ monthlyEscrowPaymentCents: escrowPaymentCents }).where(eq(contracts.id, contract.id));
    }

    if (linkDraft) {
      await tx
        .update(contractOnboardingDrafts)
        .set({ status: "PUBLISHED", publishedContractId: contract.id, publishedAt: new Date(), updatedBy: linkDraft.updatedBy, updatedAt: new Date() })
        .where(eq(contractOnboardingDrafts.id, linkDraft.id));
    }

    return contract.id;
  });

  return { contractId };
}

export async function createLandContractAction(_prevState: WizardFormState | undefined, formData: FormData): Promise<WizardFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  const result = await createLandContract(formData);
  if (result.error) return { error: result.error };
  redirect(`/contracts/${result.contractId}`);
}

export async function submitContractDraftAction(
  draftId: string,
  _prevState: WizardFormState | undefined,
  formData: FormData
): Promise<WizardFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const updatedBy = user?.email ?? null;
  try {
    await requireEditAccess(updatedBy);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  if (formData.get("intent") === "save") {
    await saveContractDraft(draftId, collectAnswers(formData), updatedBy);
    revalidatePath(`/onboarding/manual/${draftId}`);
    revalidatePath("/onboarding/manual");
    return { success: "Draft saved." };
  }

  const draft = await getContractDraft(draftId);
  if (!draft) return { error: "Draft not found." };
  if (draft.status === "PUBLISHED") return { error: "This draft has already been used to create a contract." };

  // Save first, always — if createLandContract's own validation rejects the
  // submission below, the draft still reflects everything just typed rather
  // than whatever was last explicitly saved (often nothing), so revisiting
  // the draft after fixing one field never means starting over.
  await saveContractDraft(draftId, collectAnswers(formData), updatedBy);
  revalidatePath(`/onboarding/manual/${draftId}`);

  const result = await createLandContract(formData, { id: draftId, updatedBy });
  if (result.error) return { error: result.error };

  revalidatePath("/onboarding/manual");
  redirect(`/contracts/${result.contractId}`);
}

export async function createDraftAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await requireEditAccess(user?.email);
  const id = await createContractDraft(user?.email ?? null);
  redirect(`/onboarding/manual/${id}`);
}

export interface DeleteContractDraftState {
  error?: string;
}

// Only for a still-DRAFT row — a PUBLISHED one is a real contract now and
// must be removed (if at all) via that contract's own Danger Zone.
export async function deleteContractDraftAction(
  draftId: string,
  _prevState: DeleteContractDraftState | undefined
): Promise<DeleteContractDraftState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  const draft = await getContractDraft(draftId);
  if (!draft) return { error: "Draft not found." };
  if (draft.status === "PUBLISHED") {
    return { error: "This draft has already been used to create a contract — delete it from the contract's own page instead." };
  }

  await deleteContractDraft(draftId);
  revalidatePath("/onboarding/manual");
  return {};
}
