import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Every field mirrors a form field name in the onboarding wizard
// (src/app/onboarding/_components/*) 1:1, so the result maps straight into
// LandContractInitialValues with no remapping layer. All string fields use
// an empty-string sentinel for "not found in either document" (same
// convention as src/server/checkExtraction.ts) rather than true null, since
// structured-output strict mode requires every property to be present.
const LAND_CONTRACT_SCHEMA = {
  type: "object",
  properties: {
    borrowerPartyType: { type: "string", enum: ["INDIVIDUAL", "BUSINESS"], description: "Whether the borrower is an individual person or a business entity." },
    borrowerFirstName: { type: "string", description: "Borrower's first name. Empty string if a business or not found." },
    borrowerLastName: { type: "string", description: "Borrower's last name. Empty string if a business or not found." },
    borrowerMiddleInitial: { type: "string", description: "Borrower's middle initial, one letter. Empty string if not found." },
    borrowerCompanyName: { type: "string", description: "Borrower's company name, only if the borrower is a business. Empty string otherwise." },
    borrowerEmail: { type: "string", description: "Borrower's email address. Empty string if not found." },
    borrowerPhone: { type: "string", description: "Borrower's phone number. Empty string if not found." },
    hasCoBorrower: { type: "boolean", description: "True if a second borrower/co-buyer is named on the documents." },
    coBorrowerPartyType: { type: "string", enum: ["INDIVIDUAL", "BUSINESS"], description: "Same as borrowerPartyType, for the co-borrower. Ignored if hasCoBorrower is false." },
    coBorrowerFirstName: { type: "string", description: "Co-borrower's first name. Empty string if none or a business." },
    coBorrowerLastName: { type: "string", description: "Co-borrower's last name. Empty string if none or a business." },
    coBorrowerMiddleInitial: { type: "string", description: "Co-borrower's middle initial. Empty string if not found." },
    coBorrowerCompanyName: { type: "string", description: "Co-borrower's company name, only if a business. Empty string otherwise." },
    coBorrowerEmail: { type: "string", description: "Co-borrower's email address. Empty string if not found." },
    coBorrowerPhone: { type: "string", description: "Co-borrower's phone number. Empty string if not found." },

    streetAddress: { type: "string", description: "The property's street address. Empty string if not found." },
    city: { type: "string", description: "The property's city. Empty string if not found." },
    state: { type: "string", description: "The property's state, two-letter abbreviation if possible. Empty string if not found." },
    zip: { type: "string", description: "The property's zip code. Empty string if not found." },
    county: { type: "string", description: "The property's county. Empty string if not found." },
    parcelNumber: { type: "string", description: "The property's parcel/tax ID number. Empty string if not found." },
    legalDescription: { type: "string", description: "The property's full legal description, verbatim. Empty string if not found." },
    propertyType: {
      type: "string",
      enum: ["SINGLE_FAMILY", "MULTI_FAMILY", "COMMERCIAL", "OTHER", ""],
      description: "The property type if statable from the documents. Empty string if not determinable — do not guess.",
    },

    contractNumber: { type: "string", description: "Any account/contract/loan number printed on the documents. Empty string if not found." },
    purchasePrice: { type: "string", description: "Purchase price in dollars, plain decimal like 150000.00. Empty string if not found." },
    downPayment: { type: "string", description: "Down payment in dollars, plain decimal. Empty string if not found." },
    originalPrincipal: { type: "string", description: "Original principal/loan amount financed, in dollars, plain decimal. Empty string if not found." },
    interestRateAnnual: { type: "string", description: "Annual interest rate as a plain percent number, e.g. 9.5 (not 0.095). Empty string if not found." },
    amortizationTermMonths: { type: "string", description: "Loan amortization term in months (convert years to months if needed). Empty string if not found." },
    paymentAmount: { type: "string", description: "Regular scheduled payment amount, in dollars, plain decimal. Empty string if not found." },
    paymentFrequency: {
      type: "string",
      enum: ["MONTHLY", "SEMI_MONTHLY", "BIWEEKLY", ""],
      description: "How often payments are due. Empty string if not determinable.",
    },
    originationDate: { type: "string", description: "Contract origination/closing date, in YYYY-MM-DD format. Empty string if not found." },
    firstPaymentDate: { type: "string", description: "First payment due date, in YYYY-MM-DD format. Empty string if not found." },
    maturityDate: { type: "string", description: "Loan maturity date, in YYYY-MM-DD format. Empty string if not found." },
    hasBalloon: { type: "boolean", description: "True if the documents describe a balloon payment." },
    balloonAmount: { type: "string", description: "Balloon payment amount in dollars, plain decimal. Empty string if none or not found." },
    balloonDueDate: { type: "string", description: "Balloon payment due date, YYYY-MM-DD. Empty string if none or not found." },
    escrowRequired: { type: "boolean", description: "True if the documents indicate taxes/insurance are escrowed/impounded." },
    projectedAnnualTax: { type: "string", description: "Projected/estimated annual property tax in dollars, plain decimal. Empty string if not found." },
    projectedAnnualInsurance: { type: "string", description: "Projected/estimated annual homeowners insurance in dollars, plain decimal. Empty string if not found." },
  },
  required: [
    "borrowerPartyType", "borrowerFirstName", "borrowerLastName", "borrowerMiddleInitial", "borrowerCompanyName", "borrowerEmail", "borrowerPhone",
    "hasCoBorrower", "coBorrowerPartyType", "coBorrowerFirstName", "coBorrowerLastName", "coBorrowerMiddleInitial", "coBorrowerCompanyName", "coBorrowerEmail", "coBorrowerPhone",
    "streetAddress", "city", "state", "zip", "county", "parcelNumber", "legalDescription", "propertyType",
    "contractNumber", "purchasePrice", "downPayment", "originalPrincipal", "interestRateAnnual", "amortizationTermMonths",
    "paymentAmount", "paymentFrequency", "originationDate", "firstPaymentDate", "maturityDate",
    "hasBalloon", "balloonAmount", "balloonDueDate", "escrowRequired", "projectedAnnualTax", "projectedAnnualInsurance",
  ],
  additionalProperties: false,
};

// Mirrors the wizard's LandContractInitialValues shape exactly (see
// src/app/onboarding/_components/NewContractWizard.tsx) so callers can pass
// this straight through as `initial` with no remapping.
export interface ExtractedLandContract {
  borrowerPartyType: "INDIVIDUAL" | "BUSINESS";
  borrowerFirstName: string | null;
  borrowerLastName: string | null;
  borrowerMiddleInitial: string | null;
  borrowerCompanyName: string | null;
  borrowerEmail: string | null;
  borrowerPhone: string | null;
  hasCoBorrower: boolean;
  coBorrowerPartyType: "INDIVIDUAL" | "BUSINESS";
  coBorrowerFirstName: string | null;
  coBorrowerLastName: string | null;
  coBorrowerMiddleInitial: string | null;
  coBorrowerCompanyName: string | null;
  coBorrowerEmail: string | null;
  coBorrowerPhone: string | null;

  streetAddress: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  parcelNumber: string | null;
  legalDescription: string | null;
  propertyType: "SINGLE_FAMILY" | "MULTI_FAMILY" | "COMMERCIAL" | "OTHER" | null;

  contractNumber: string | null;
  purchasePrice: string | null;
  downPayment: string | null;
  originalPrincipal: string | null;
  interestRateAnnual: string | null;
  amortizationTermMonths: string | null;
  paymentAmount: string | null;
  paymentFrequency: "MONTHLY" | "SEMI_MONTHLY" | "BIWEEKLY" | null;
  originationDate: string | null;
  firstPaymentDate: string | null;
  maturityDate: string | null;
  hasBalloon: boolean;
  balloonAmount: string | null;
  balloonDueDate: string | null;
  escrowRequired: boolean;
  projectedAnnualTax: string | null;
  projectedAnnualInsurance: string | null;
}

export interface SourceDocument {
  base64: string;
  label: "Closing Package" | "Closing Disclosure";
}

function emptyToNull(value: string): string | null {
  return value.trim() ? value.trim() : null;
}

// One call reads both documents together (rather than two independent
// calls) so a field split across them — e.g. the buyer's name in the
// Closing Package, the interest rate in the Closing Disclosure — still
// gets cross-referenced instead of missed.
export async function extractLandContractData(documents: SourceDocument[]): Promise<ExtractedLandContract> {
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    output_config: { format: { type: "json_schema", schema: LAND_CONTRACT_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          ...documents.map((doc) => ({
            type: "document" as const,
            source: { type: "base64" as const, media_type: "application/pdf" as const, data: doc.base64 },
            title: doc.label,
          })),
          {
            type: "text" as const,
            text: "These are the Closing Package and/or Closing Disclosure for a new land contract. Extract every field in the schema. Leave a field as an empty string (or false for booleans) if it genuinely isn't stated in either document — never guess or infer a value that isn't actually written down.",
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) throw new Error("No text response from land contract extraction.");

  const parsed = JSON.parse(textBlock.text) as Record<string, string | boolean>;

  return {
    borrowerPartyType: parsed.borrowerPartyType === "BUSINESS" ? "BUSINESS" : "INDIVIDUAL",
    borrowerFirstName: emptyToNull(parsed.borrowerFirstName as string),
    borrowerLastName: emptyToNull(parsed.borrowerLastName as string),
    borrowerMiddleInitial: emptyToNull(parsed.borrowerMiddleInitial as string),
    borrowerCompanyName: emptyToNull(parsed.borrowerCompanyName as string),
    borrowerEmail: emptyToNull(parsed.borrowerEmail as string),
    borrowerPhone: emptyToNull(parsed.borrowerPhone as string),
    hasCoBorrower: Boolean(parsed.hasCoBorrower),
    coBorrowerPartyType: parsed.coBorrowerPartyType === "BUSINESS" ? "BUSINESS" : "INDIVIDUAL",
    coBorrowerFirstName: emptyToNull(parsed.coBorrowerFirstName as string),
    coBorrowerLastName: emptyToNull(parsed.coBorrowerLastName as string),
    coBorrowerMiddleInitial: emptyToNull(parsed.coBorrowerMiddleInitial as string),
    coBorrowerCompanyName: emptyToNull(parsed.coBorrowerCompanyName as string),
    coBorrowerEmail: emptyToNull(parsed.coBorrowerEmail as string),
    coBorrowerPhone: emptyToNull(parsed.coBorrowerPhone as string),

    streetAddress: emptyToNull(parsed.streetAddress as string),
    city: emptyToNull(parsed.city as string),
    state: emptyToNull(parsed.state as string),
    zip: emptyToNull(parsed.zip as string),
    county: emptyToNull(parsed.county as string),
    parcelNumber: emptyToNull(parsed.parcelNumber as string),
    legalDescription: emptyToNull(parsed.legalDescription as string),
    propertyType: (emptyToNull(parsed.propertyType as string) as ExtractedLandContract["propertyType"]) ?? null,

    contractNumber: emptyToNull(parsed.contractNumber as string),
    purchasePrice: emptyToNull(parsed.purchasePrice as string),
    downPayment: emptyToNull(parsed.downPayment as string),
    originalPrincipal: emptyToNull(parsed.originalPrincipal as string),
    interestRateAnnual: emptyToNull(parsed.interestRateAnnual as string),
    amortizationTermMonths: emptyToNull(parsed.amortizationTermMonths as string),
    paymentAmount: emptyToNull(parsed.paymentAmount as string),
    paymentFrequency: (emptyToNull(parsed.paymentFrequency as string) as ExtractedLandContract["paymentFrequency"]) ?? null,
    originationDate: emptyToNull(parsed.originationDate as string),
    firstPaymentDate: emptyToNull(parsed.firstPaymentDate as string),
    maturityDate: emptyToNull(parsed.maturityDate as string),
    hasBalloon: Boolean(parsed.hasBalloon),
    balloonAmount: emptyToNull(parsed.balloonAmount as string),
    balloonDueDate: emptyToNull(parsed.balloonDueDate as string),
    escrowRequired: Boolean(parsed.escrowRequired),
    projectedAnnualTax: emptyToNull(parsed.projectedAnnualTax as string),
    projectedAnnualInsurance: emptyToNull(parsed.projectedAnnualInsurance as string),
  };
}
