import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const CHECK_SCHEMA = {
  type: "object",
  properties: {
    payerName: {
      type: "string",
      description: "The name printed on the check as the payer/drawer (the account holder's name, top-left of the check). Empty string if not legible.",
    },
    amount: {
      type: "number",
      description: "The check amount in dollars as a plain number, e.g. 1234.56. Use the numeric box amount; cross-check against the written amount if both are visible.",
    },
    checkNumber: {
      type: "string",
      description: "The check number, or empty string if not visible.",
    },
    date: {
      type: "string",
      description: "The date written on the check, in MM/DD/YYYY format, or empty string if not visible.",
    },
  },
  required: ["payerName", "amount", "checkNumber", "date"],
  additionalProperties: false,
};

export interface ExtractedCheck {
  payerName: string;
  amountCents: number;
  checkNumber: string | null;
  date: string | null;
}

// Reads a single check image via Claude's vision + structured outputs, so the
// response is guaranteed to match CHECK_SCHEMA rather than free text we'd
// have to parse ourselves.
export async function extractCheckData(base64Image: string, mediaType: string): Promise<ExtractedCheck> {
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 512,
    output_config: { format: { type: "json_schema", schema: CHECK_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: base64Image } },
          { type: "text", text: "Read this check image and extract the payer name, amount, check number, and date." },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) throw new Error("No text response from check extraction.");

  const parsed = JSON.parse(textBlock.text) as { payerName: string; amount: number; checkNumber: string; date: string };

  return {
    payerName: parsed.payerName.trim(),
    amountCents: Math.round(parsed.amount * 100),
    checkNumber: parsed.checkNumber.trim() || null,
    date: parsed.date.trim() || null,
  };
}
