import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Every field mirrors the summary box on page 1 of a standard Closing
// Disclosure ("Loan Terms" / "Projected Payments" / "Costs at Closing") —
// the same figures this app's own Closing Statement engine computes for a
// land contract package, so staff can cross-check the two side by side.
// Empty-string sentinel for "not found" (same convention as
// src/server/landContractExtraction.ts).
const CLOSING_DISCLOSURE_SCHEMA = {
  type: "object",
  properties: {
    salePrice: { type: "string", description: "Sale price in dollars, plain decimal like 150000.00. Empty string if not found." },
    loanAmount: { type: "string", description: "Loan amount / amount financed, in dollars, plain decimal. Empty string if not found." },
    downPayment: {
      type: "string",
      description: "Down payment / funds from borrower at closing toward the purchase, in dollars, plain decimal. Empty string if not found.",
    },
    interestRateAnnual: { type: "string", description: "Annual interest rate as a plain percent number, e.g. 8.5 (not 0.085). Empty string if not found." },
    monthlyPrincipalAndInterest: {
      type: "string",
      description: "Monthly principal and interest payment, in dollars, plain decimal. Empty string if not found.",
    },
    cashToCloseFromBorrower: {
      type: "string",
      description: "Total cash to close due from the borrower, in dollars, plain decimal. Empty string if not found.",
    },
    totalClosingCosts: { type: "string", description: "Total closing costs, in dollars, plain decimal. Empty string if not found." },
  },
  required: ["salePrice", "loanAmount", "downPayment", "interestRateAnnual", "monthlyPrincipalAndInterest", "cashToCloseFromBorrower", "totalClosingCosts"],
  additionalProperties: false,
};

export interface ExtractedClosingDisclosure {
  salePrice: string | null;
  loanAmount: string | null;
  downPayment: string | null;
  interestRateAnnual: string | null;
  monthlyPrincipalAndInterest: string | null;
  cashToCloseFromBorrower: string | null;
  totalClosingCosts: string | null;
}

function emptyToNull(value: string): string | null {
  return value.trim() ? value.trim() : null;
}

export async function extractClosingDisclosureData(base64Pdf: string): Promise<ExtractedClosingDisclosure> {
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    output_config: { format: { type: "json_schema", schema: CLOSING_DISCLOSURE_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64Pdf },
            title: "Buyer Closing Disclosure",
          },
          {
            type: "text",
            text: "This is a Buyer Closing Disclosure for a land contract closing. Extract every field in the schema from its summary figures. Leave a field as an empty string if it genuinely isn't stated — never guess or infer a value that isn't actually written down.",
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) throw new Error("No text response from Closing Disclosure extraction.");

  const parsed = JSON.parse(textBlock.text) as Record<string, string>;

  return {
    salePrice: emptyToNull(parsed.salePrice),
    loanAmount: emptyToNull(parsed.loanAmount),
    downPayment: emptyToNull(parsed.downPayment),
    interestRateAnnual: emptyToNull(parsed.interestRateAnnual),
    monthlyPrincipalAndInterest: emptyToNull(parsed.monthlyPrincipalAndInterest),
    cashToCloseFromBorrower: emptyToNull(parsed.cashToCloseFromBorrower),
    totalClosingCosts: emptyToNull(parsed.totalClosingCosts),
  };
}
